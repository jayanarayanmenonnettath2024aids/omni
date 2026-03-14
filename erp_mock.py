from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Optional
import datetime
from processing.ai_assistant import get_ai_response
from processing.audit import run_audit
from main import run_pipeline
import os
import httpx
import glob
import uuid
import io
import csv
import threading
from dotenv import load_dotenv
from apscheduler.schedulers.background import BackgroundScheduler
from ingestion.excel_ingest import ingest_excel
from ingestion.pdf_ingest import extract_pdf_text_and_tables
from ingestion.email_imap_ingest import ingest_unseen_emails
from processing.transform import transform_excel_record, transform_pdf_record, transform_email_record, transform_erp_record, transform_portal_record
from processing.mdm import apply_mdm
from processing.document_parser import parse_trade_document
from processing.database import (
    init_db,
    save_to_data_lake,
    get_vector_db_stats,
    seed_erp_transactions,
    seed_portal_shipments,
    seed_users,
    authenticate_user,
    register_user,
    get_erp_transactions as db_get_erp_transactions,
    get_portal_shipments as db_get_portal_shipments,
    insert_order_transaction,
    mirror_unified_to_erp_transactions,
    get_dashboard_insights,
    get_storage_status,
    record_ingestion_run,
    get_ingestion_connector_stats,
    sync_vector_from_operational_data,
    ensure_vector_sync_with_operational_data,
    get_master_data_stats,
    sync_master_data_from_operational_records,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Always load env from project root and override inherited shell values.
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)

app = FastAPI()

pipeline_scheduler = BackgroundScheduler()
pipeline_scheduler_lock = threading.Lock()
pipeline_status = {
    "enabled": False,
    "interval_minutes": 0,
    "last_run_at": "",
    "last_status": "idle",
    "last_message": "",
    "ocr_enabled": True,
    "nlp_parser": "regex-heuristic-parser",
}

DEFAULT_EXCEL_PATH = os.path.join(BASE_DIR, "data", "logistics_shipments.xlsx")
DEFAULT_PDF_GLOB = os.path.join(BASE_DIR, "data", "*.pdf")
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")


def resolve_repo_path(path_value: Optional[str], default_value: str) -> str:
    candidate = (path_value or default_value).strip() if path_value else default_value
    if os.path.isabs(candidate):
        return candidate
    return os.path.join(BASE_DIR, candidate)

class Order(BaseModel):
    client_name: str
    item: str
    qty: int
    rate: float


class IngestRequest(BaseModel):
    file_path: Optional[str] = None
    file_glob: Optional[str] = None
    username: Optional[str] = None
    app_password: Optional[str] = None


class LoginRequest(BaseModel):
    user_id: str
    password: str


class RegisterRequest(BaseModel):
    user_id: str
    password: str
    display_name: str
    role: str = "domestic"


class VoiceSessionStartRequest(BaseModel):
    agent_id: Optional[str] = None
    user_identity: Optional[str] = None
    room_name: Optional[str] = None


class VoiceSessionEndRequest(BaseModel):
    room_name: str


def _resolve_lyzr_url(base_url: str, path: str) -> str:
    clean = (path or "").strip()
    if clean.startswith("http://") or clean.startswith("https://"):
        return clean
    if not clean:
        return base_url
    if not clean.startswith("/"):
        clean = f"/{clean}"
    return f"{base_url}{clean}"


def _lyzr_start_candidates(base_url: str):
    configured = os.getenv("LYZR_VOICE_SESSION_START_PATH", "").strip()
    candidates = []
    if configured:
        candidates.append(_resolve_lyzr_url(base_url, configured))
    # Fallback list supports old and alternative gateway layouts.
    candidates.extend(
        [
            f"{base_url}/v1/sessions/start",
            f"{base_url}/v1/session/start",
            f"{base_url}/api/v1/session/start",
            f"{base_url}/session/start",
        ]
    )
    return candidates


def _lyzr_end_candidates(base_url: str):
    configured = os.getenv("LYZR_VOICE_SESSION_END_PATH", "").strip()
    candidates = []
    if configured:
        candidates.append(_resolve_lyzr_url(base_url, configured))
    candidates.extend(
        [
            f"{base_url}/v1/sessions/end",
            f"{base_url}/v1/session/end",
            f"{base_url}/api/v1/session/end",
            f"{base_url}/session/end",
        ]
    )
    return candidates


async def _post_lyzr_with_fallback(client: httpx.AsyncClient, urls: List[str], payload: Dict, headers: Dict):
    attempts = []
    for url in urls:
        try:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code < 400:
                return response, attempts
            attempts.append({"url": url, "status": response.status_code, "body": (response.text or "")[:200]})
            if response.status_code not in (404, 405):
                return response, attempts
        except Exception as exc:
            attempts.append({"url": url, "status": "error", "body": str(exc)[:200]})
    return None, attempts


def _scheduler_enabled():
    return os.getenv("ETL_SCHEDULER_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")


def _scheduler_interval_minutes():
    try:
        return max(5, int(os.getenv("ETL_SCHEDULER_INTERVAL_MINUTES", "30")))
    except Exception:
        return 30


def _run_scheduled_etl():
    if not pipeline_scheduler_lock.acquire(blocking=False):
        return
    try:
        pipeline_status["last_status"] = "running"
        pipeline_status["last_message"] = "Scheduled ETL run in progress"
        result = trigger_all_ingestion(IngestRequest())
        pipeline_status["last_run_at"] = datetime.datetime.now().isoformat(timespec="seconds")
        pipeline_status["last_status"] = result.get("status", "success")
        pipeline_status["last_message"] = f"Processed {result.get('summary', {}).get('total_records', 0)} records"
    except Exception as exc:
        pipeline_status["last_run_at"] = datetime.datetime.now().isoformat(timespec="seconds")
        pipeline_status["last_status"] = "error"
        pipeline_status["last_message"] = str(exc)
    finally:
        pipeline_scheduler_lock.release()

# In-memory mock database
MOCK_TRANSACTIONS = [
    {"invoice_no": "LOG-INV-2026-004", "client_name": "Metro Retailers", "gst_id": "33METRO1234F1Z1", "item": "Laptops - 50 Units", "category": "Electronics", "hs_code": "8471", "qty": 50, "rate": 45000, "date": "2026-03-31", "trade_type": "DOMESTIC", "origin": "Bangalore", "destination": "Chennai", "port": None, "customs_duty": None},
    {"invoice_no": "LOG-EXP-2026-002", "client_name": "TechCorp Industries", "gst_id": "33TECH8899F1Z5", "item": "Semiconductors - High Grade", "category": "Electronics", "hs_code": "8542", "qty": 1000, "rate": 1500, "date": "2026-03-29", "trade_type": "EXPORT", "origin": "Chennai", "destination": "Dubai", "port": "Chennai Port", "customs_duty": 0},
    {"invoice_no": "LOG-IMP-2026-003", "client_name": "Oceanic Importers", "gst_id": "33OCEAN7777F1Z1", "item": "Crude Oil - Brent", "category": "Energy", "hs_code": "2709", "qty": 500, "rate": 6500, "date": "2026-04-01", "trade_type": "IMPORT", "origin": "UAE", "destination": "Kochi", "port": "Kochi Port", "customs_duty": 450000},
    {"invoice_no": "LOG-EXP-2026-008", "client_name": "Global Knit Exports", "gst_id": "33NORD9900F1Z4", "item": "Premium Yarn", "category": "Textiles", "hs_code": "5205", "qty": 100, "rate": 800, "date": "2026-04-02", "trade_type": "EXPORT", "origin": "Tiruppur", "destination": "Oslo", "port": "Chennai Port", "customs_duty": 0},
    {"invoice_no": "LOG-INV-2026-009", "client_name": "Spice Bazaar", "gst_id": "27REL1234F1Z9", "item": "Spices - Export Grade", "category": "Agriculture", "hs_code": "0904", "qty": 200, "rate": 450, "date": "2026-04-03", "trade_type": "DOMESTIC", "origin": "Kochi", "destination": "Mumbai", "port": None, "customs_duty": None},
    {"invoice_no": "LOG-IMP-2026-010", "client_name": "Global Tech Solns", "gst_id": "33GLOBA5566F1Z2", "item": "Semiconductors - Nano Chip", "category": "Electronics", "hs_code": "8542", "qty": 500, "rate": 5000, "date": "2026-04-04", "trade_type": "IMPORT", "origin": "Taiwan", "destination": "Chennai", "port": "Chennai Port", "customs_duty": 1250000},
    {"invoice_no": "LOG-EXP-2026-011", "client_name": "Omega Trading Co.", "gst_id": "33OMEGA1122F1Z3", "item": "Organic Spices", "category": "Agriculture", "hs_code": "0910", "qty": 200, "rate": 450, "date": "2026-04-05", "trade_type": "EXPORT", "origin": "Kochi", "destination": "New York", "port": "Kochi Port", "customs_duty": 0},
    {"invoice_no": "LOG-INV-2026-012", "client_name": "Heritage Fabrics", "gst_id": "33HERIT7788F1Z4", "item": "Cotton Yarn - Bulk", "category": "Textiles", "hs_code": "5205", "qty": 50, "rate": 1200, "date": "2026-04-06", "trade_type": "DOMESTIC", "origin": "Coimbatore", "destination": "Delhi", "port": None, "customs_duty": None},
    {"invoice_no": "LOG-IMP-2026-013", "client_name": "Oil Corp India", "gst_id": "33PRECI3344F1Z5", "item": "Crude Oil", "category": "Energy", "hs_code": "2709", "qty": 1000, "rate": 6000, "date": "2026-04-07", "trade_type": "IMPORT", "origin": "Saudi Arabia", "destination": "Mumbai Port", "port": "Nhava Sheva", "customs_duty": 8000000},
    {"invoice_no": "LOG-EXP-2026-014", "client_name": "Indo Yarn Ltd", "gst_id": "33COAST9900F1Z6", "item": "Laptops - Export", "category": "Electronics", "hs_code": "8471", "qty": 100, "rate": 40000, "date": "2026-04-08", "trade_type": "EXPORT", "origin": "Bangalore", "destination": "Dubai", "port": "Chennai Port", "customs_duty": 0},
    {"invoice_no": "LOG-IMP-2026-015", "client_name": "Precision Tools", "gst_id": "33PREC9988F1Z7", "item": "Semiconductors - Tech Grade", "category": "Electronics", "hs_code": "8542", "qty": 300, "rate": 8500, "date": "2026-04-10", "trade_type": "IMPORT", "origin": "South Korea", "destination": "Bangalore Air Cargo", "port": "Bangalore Airport", "customs_duty": 255000},
    {"invoice_no": "LOG-IMP-2026-020", "client_name": "Cloud Infra Ltd", "gst_id": "33CLOU8822F1Z8", "item": "High Performance Laptops", "category": "Electronics", "hs_code": "8471", "qty": 200, "rate": 65000, "date": "2026-04-12", "trade_type": "IMPORT", "origin": "USA", "destination": "Mumbai", "port": "JNPT", "customs_duty": 1300000},
]

MOCK_SHIPMENTS = [
    {"invoice_no": "LOG-EXP-2026-002", "shipping_bill_no": "SBC-EXP-552", "port": "Chennai Port", "clearance_status": "Cleared for Export", "clearance_date": "2026-03-30"},
    {"invoice_no": "LOG-IMP-2026-003", "shipping_bill_no": "SBC-IMP-109", "port": "Kochi Port", "clearance_status": "Awaiting Customs Duty", "clearance_date": "Pending"},
    {"invoice_no": "LOG-EXP-2026-008", "shipping_bill_no": "SBC-EXP-612", "port": "Chennai Port", "clearance_status": "Customs Inspection Complete", "clearance_date": "2026-04-03"},
    {"invoice_no": "LOG-IMP-2026-010", "shipping_bill_no": "SBC-IMP-205", "port": "Chennai Port", "clearance_status": "Gate-In at Port", "clearance_date": "2026-04-04"},
    {"invoice_no": "LOG-EXP-2026-011", "shipping_bill_no": "SBC-EXP-333", "port": "Kochi Port", "clearance_status": "Handed to Shipping Line", "clearance_date": "2026-04-05"},
    {"invoice_no": "LOG-IMP-2026-013", "shipping_bill_no": "SBC-IMP-441", "port": "Nhava Sheva", "clearance_status": "Document Verification Pending", "clearance_date": "Pending"},
    {"invoice_no": "LOG-EXP-2026-014", "shipping_bill_no": "SBC-EXP-555", "port": "Chennai Port", "clearance_status": "Vessel Departed", "clearance_date": "2026-04-09"},
]

APP_USERS = [
    {"user_id": "export_mgr", "password": "export@123", "role": "export", "display_name": "Export Manager"},
    {"user_id": "import_desk", "password": "import@123", "role": "import", "display_name": "Import Desk"},
    {"user_id": "logistics_lead", "password": "domestic@123", "role": "domestic", "display_name": "Logistics Lead"},
    {"user_id": "port_admin", "password": "super@123", "role": "super", "display_name": "Port Authority (Super)"},
]

MORE_MOCK_TRANSACTIONS = [
    {"invoice_no": "LOG-EXP-2026-021", "client_name": "Apex Marine Exports", "gst_id": "33APEX8822F1Z1", "item": "Marine Pumps", "category": "Machinery", "hs_code": "8413", "qty": 40, "rate": 185000, "date": "2026-04-11", "trade_type": "EXPORT", "origin": "Chennai", "destination": "Rotterdam", "port": "Chennai Port", "customs_duty": 0},
    {"invoice_no": "LOG-IMP-2026-022", "client_name": "Nano Circuit Labs", "gst_id": "29NANO2244F1Z8", "item": "Semiconductor Wafers", "category": "Electronics", "hs_code": "8542", "qty": 650, "rate": 7200, "date": "2026-04-11", "trade_type": "IMPORT", "origin": "Japan", "destination": "Hyderabad Air Cargo", "port": "Hyderabad Airport", "customs_duty": 830000},
    {"invoice_no": "LOG-INV-2026-023", "client_name": "Southern Retail Grid", "gst_id": "33SOUT1122F1Z7", "item": "Warehouse Servers", "category": "Electronics", "hs_code": "8471", "qty": 18, "rate": 98000, "date": "2026-04-11", "trade_type": "DOMESTIC", "origin": "Bangalore", "destination": "Madurai", "port": None, "customs_duty": None},
    {"invoice_no": "LOG-EXP-2026-024", "client_name": "Blue River Textiles", "gst_id": "33BLUE0033F1Z4", "item": "Organic Cotton Yarn", "category": "Textiles", "hs_code": "5205", "qty": 250, "rate": 1450, "date": "2026-04-12", "trade_type": "EXPORT", "origin": "Tiruppur", "destination": "Barcelona", "port": "Tuticorin Port", "customs_duty": 0},
    {"invoice_no": "LOG-IMP-2026-025", "client_name": "Urban Energy Grid", "gst_id": "27URBA7711F1Z6", "item": "Industrial Batteries", "category": "Energy", "hs_code": "8507", "qty": 90, "rate": 56000, "date": "2026-04-12", "trade_type": "IMPORT", "origin": "Germany", "destination": "Mumbai", "port": "Nhava Sheva", "customs_duty": 510000},
    {"invoice_no": "LOG-INV-2026-026", "client_name": "Coastal Spice House", "gst_id": "32COAS5511F1Z1", "item": "Processed Spices", "category": "Agriculture", "hs_code": "0910", "qty": 350, "rate": 620, "date": "2026-04-12", "trade_type": "DOMESTIC", "origin": "Kochi", "destination": "Hyderabad", "port": None, "customs_duty": None},
    {"invoice_no": "LOG-EXP-2026-027", "client_name": "Skyline Aero Parts", "gst_id": "29SKYL1188F1Z2", "item": "Aero Fasteners", "category": "Machinery", "hs_code": "7318", "qty": 1200, "rate": 980, "date": "2026-04-13", "trade_type": "EXPORT", "origin": "Bangalore", "destination": "Singapore", "port": "Chennai Port", "customs_duty": 0},
    {"invoice_no": "LOG-IMP-2026-028", "client_name": "Delta Precision Works", "gst_id": "33DELT0099F1Z9", "item": "CNC Tooling", "category": "Machinery", "hs_code": "8207", "qty": 140, "rate": 42000, "date": "2026-04-13", "trade_type": "IMPORT", "origin": "Italy", "destination": "Chennai", "port": "Chennai Port", "customs_duty": 680000},
    {"invoice_no": "LOG-INV-2026-029", "client_name": "Metro Med Devices", "gst_id": "33METM6633F1Z5", "item": "Medical Sensors", "category": "Electronics", "hs_code": "9027", "qty": 240, "rate": 8400, "date": "2026-04-13", "trade_type": "DOMESTIC", "origin": "Pune", "destination": "Chennai", "port": None, "customs_duty": None},
    {"invoice_no": "LOG-EXP-2026-030", "client_name": "Evergreen Agro World", "gst_id": "29EVER2211F1Z3", "item": "Dry Red Chillies", "category": "Agriculture", "hs_code": "0904", "qty": 480, "rate": 520, "date": "2026-04-13", "trade_type": "EXPORT", "origin": "Guntur", "destination": "Doha", "port": "Krishnapatnam Port", "customs_duty": 0},
    {"invoice_no": "LOG-IMP-2026-031", "client_name": "Prime Auto Hub", "gst_id": "27PRIM9009F1Z7", "item": "EV Drivetrain Modules", "category": "Machinery", "hs_code": "8708", "qty": 70, "rate": 89000, "date": "2026-04-14", "trade_type": "IMPORT", "origin": "South Korea", "destination": "Chennai", "port": "Chennai Port", "customs_duty": 730000},
    {"invoice_no": "LOG-INV-2026-032", "client_name": "National Fibre Links", "gst_id": "33NATI8821F1Z6", "item": "Fiber Optic Routers", "category": "Electronics", "hs_code": "8517", "qty": 55, "rate": 67000, "date": "2026-04-14", "trade_type": "DOMESTIC", "origin": "Noida", "destination": "Coimbatore", "port": None, "customs_duty": None},
]

MORE_MOCK_SHIPMENTS = [
    {"invoice_no": "LOG-EXP-2026-021", "shipping_bill_no": "SBC-EXP-621", "port": "Chennai Port", "clearance_status": "Cleared for Export", "clearance_date": "2026-04-11"},
    {"invoice_no": "LOG-IMP-2026-022", "shipping_bill_no": "SBC-IMP-722", "port": "Hyderabad Airport", "clearance_status": "Awaiting Customs Assessment", "clearance_date": "Pending"},
    {"invoice_no": "LOG-EXP-2026-024", "shipping_bill_no": "SBC-EXP-624", "port": "Tuticorin Port", "clearance_status": "Stuffing Complete", "clearance_date": "2026-04-12"},
    {"invoice_no": "LOG-IMP-2026-025", "shipping_bill_no": "SBC-IMP-725", "port": "Nhava Sheva", "clearance_status": "Document Verification Pending", "clearance_date": "Pending"},
    {"invoice_no": "LOG-EXP-2026-027", "shipping_bill_no": "SBC-EXP-627", "port": "Chennai Port", "clearance_status": "Handed to Shipping Line", "clearance_date": "2026-04-13"},
    {"invoice_no": "LOG-IMP-2026-028", "shipping_bill_no": "SBC-IMP-728", "port": "Chennai Port", "clearance_status": "Gate-In at Port", "clearance_date": "2026-04-13"},
    {"invoice_no": "LOG-EXP-2026-030", "shipping_bill_no": "SBC-EXP-630", "port": "Krishnapatnam Port", "clearance_status": "Customs Inspection Complete", "clearance_date": "2026-04-14"},
    {"invoice_no": "LOG-IMP-2026-031", "shipping_bill_no": "SBC-IMP-731", "port": "Chennai Port", "clearance_status": "Awaiting Customs Duty", "clearance_date": "Pending"},
]

MOCK_TRANSACTIONS.extend(MORE_MOCK_TRANSACTIONS)
MOCK_SHIPMENTS.extend(MORE_MOCK_SHIPMENTS)


def save_uploaded_file(upload: UploadFile, allowed_suffixes: tuple[str, ...]) -> str:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    _, suffix = os.path.splitext(upload.filename or "")
    suffix = suffix.lower()
    if suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {suffix or 'unknown'}")

    filename = f"{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{suffix}"
    file_path = os.path.join(UPLOAD_DIR, filename)
    with open(file_path, "wb") as handle:
        handle.write(upload.file.read())
    return file_path


@app.on_event("startup")
def startup_seed_data():
    init_db()
    seed_erp_transactions(MOCK_TRANSACTIONS)
    seed_portal_shipments(MOCK_SHIPMENTS)
    seed_users(APP_USERS)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    sync_vector_from_operational_data(reset=True)
    sync_master_data_from_operational_records()
    pipeline_status["enabled"] = _scheduler_enabled()
    pipeline_status["interval_minutes"] = _scheduler_interval_minutes()
    if pipeline_status["enabled"] and not pipeline_scheduler.running:
        pipeline_scheduler.add_job(_run_scheduled_etl, 'interval', minutes=pipeline_status["interval_minutes"], id='scheduled-etl', replace_existing=True)
        pipeline_scheduler.start()


@app.on_event("shutdown")
def shutdown_scheduler():
    if pipeline_scheduler.running:
        pipeline_scheduler.shutdown(wait=False)

# Mount static files from the React build directory
# Assuming 'npm run build' generates files in 'frontend/dist'
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")

@app.get("/", response_class=HTMLResponse)
def root_page():
    build_index = os.path.join("frontend", "dist", "index.html")
    if os.path.exists(build_index):
        with open(build_index, "r", encoding="utf-8") as f:
            return f.read()

    file_path = os.path.join(os.path.dirname(__file__), "dashboard.html")
    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


@app.get("/api/dashboard/data")
def get_dashboard_data(role: str = Query("super"), tx_limit: int = Query(100), sh_limit: int = Query(100)):
    transactions = db_get_erp_transactions()
    role_norm = (role or "super").strip().lower()
    if role_norm == "export":
        transactions = [t for t in transactions if (t.get("trade_type") or "").upper() == "EXPORT"]
    elif role_norm == "import":
        transactions = [t for t in transactions if (t.get("trade_type") or "").upper() == "IMPORT"]
    elif role_norm == "domestic":
        transactions = [t for t in transactions if (t.get("trade_type") or "").upper() == "DOMESTIC"]

    shipments = db_get_portal_shipments()
    visible_invoices = {t.get("invoice_no") for t in transactions}
    shipments = [s for s in shipments if s.get("invoice_no") in visible_invoices] if role_norm != "super" else shipments

    insights = get_dashboard_insights(role)
    return {
        "transactions": transactions[: max(1, min(tx_limit, 500))],
        "shipments": shipments[: max(1, min(sh_limit, 500))],
        "insights": insights,
    }

@app.get("/erp/transactions")
def get_transactions() -> List[Dict]:
    return db_get_erp_transactions()

@app.get("/portal/shipments")
def get_portal_shipments() -> List[Dict]:
    return db_get_portal_shipments()


@app.post("/api/auth/login")
def api_login(req: LoginRequest):
    user = authenticate_user(req.user_id, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user ID or password")
    return {"status": "success", **user}


@app.post("/api/auth/register")
def api_register(req: RegisterRequest):
    result = register_user(req.user_id, req.password, req.role, req.display_name)
    if not result.get("ok"):
        raise HTTPException(status_code=400, detail=result.get("error") or "Registration failed")
    user = result["user"]
    return {"status": "success", **user}


@app.post("/api/voice-agent/session/start")
async def start_voice_agent_session(req: VoiceSessionStartRequest):
    api_key = os.getenv("LYZR_VOICE_API_KEY", "").strip()
    agent_id = (req.agent_id or os.getenv("LYZR_VOICE_AGENT_ID", "")).strip()
    base_url = os.getenv("LYZR_VOICE_BASE_URL", "https://voice-livekit.studio.lyzr.ai").rstrip("/")
    user_identity = (req.user_identity or f"local-user-{uuid.uuid4().hex[:8]}").strip()

    if not api_key:
        raise HTTPException(status_code=500, detail="LYZR_VOICE_API_KEY not configured")
    if not agent_id:
        raise HTTPException(status_code=500, detail="LYZR_VOICE_AGENT_ID not configured")

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
    }

    try:
        payload = {
            "agentId": agent_id,
            "userIdentity": user_identity,
        }
        if req.room_name and req.room_name.strip():
            payload["roomName"] = req.room_name.strip()

        async with httpx.AsyncClient(timeout=30.0) as client:
            response, attempts = await _post_lyzr_with_fallback(
                client,
                _lyzr_start_candidates(base_url),
                payload,
                headers,
            )
        if response is None:
            raise HTTPException(status_code=502, detail={"message": "Voice agent start endpoint unavailable", "attempts": attempts})
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail={"message": "Voice agent start failed", "body": response.text[:300], "attempts": attempts})
        payload = response.json()
        return {
            "status": "success",
            "provider": "lyzr-livekit",
            "resolved_endpoint": str(response.request.url),
            **payload,
        }
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Voice agent start request timed out")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to start voice agent session: {exc}")


@app.post("/api/voice-agent/session/end")
async def end_voice_agent_session(req: VoiceSessionEndRequest):
    api_key = os.getenv("LYZR_VOICE_API_KEY", "").strip()
    base_url = os.getenv("LYZR_VOICE_BASE_URL", "https://voice-livekit.studio.lyzr.ai").rstrip("/")

    if not api_key:
        raise HTTPException(status_code=500, detail="LYZR_VOICE_API_KEY not configured")
    if not req.room_name.strip():
        raise HTTPException(status_code=400, detail="room_name is required")

    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response, attempts = await _post_lyzr_with_fallback(
                client,
                _lyzr_end_candidates(base_url),
                {"roomName": req.room_name.strip()},
                headers,
            )
        if response is None:
            raise HTTPException(status_code=502, detail={"message": "Voice agent end endpoint unavailable", "attempts": attempts})
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail={"message": "Voice agent end failed", "body": response.text[:300], "attempts": attempts})
        payload = response.json() if response.content else {"status": "ended"}
        return {"status": "success", "resolved_endpoint": str(response.request.url), **payload}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Voice agent end request timed out")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Unable to end voice agent session: {exc}")

@app.post("/api/ai/chat")
def ai_chat(query: Dict):
    user_text = query.get("message", "")
    lang = query.get("lang", "en-IN")
    history = query.get("history", [])
    return get_ai_response(user_text, lang, history)

@app.get("/api/analytics/stats")
def get_stats(role: str = "super"):
    return get_dashboard_insights(role)


@app.get("/api/analytics/insights")
def get_insights(role: str = "super"):
    return get_dashboard_insights(role)

@app.post("/api/pipeline/sync")
def trigger_sync():
    try:
        results = run_pipeline()
        return {"status": "success", "summary": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/api/ingestion/connectors")
def ingestion_connectors():
    return {"connectors": get_ingestion_connector_stats()}


@app.get("/api/pipeline/status")
def get_pipeline_status():
    next_run = None
    if pipeline_scheduler.running:
        job = pipeline_scheduler.get_job('scheduled-etl')
        next_run = job.next_run_time.isoformat() if job and job.next_run_time else None
    return {
        **pipeline_status,
        "next_run_at": next_run,
    }


@app.get("/api/mdm/status")
def mdm_status():
    return get_master_data_stats()

@app.get("/api/audit/report")
def get_audit():
    # Run the pipeline to get the current state of the data lake
    # In a real app, this would query the Postgres DB
    lake_summary = run_pipeline()
    # We need the actual records, not just summary. 
    # Let's modify main.py to optionally return the records or just mock the input for now
    # Build audit input from persisted DB records.
    formatted_data = []
    for t in db_get_erp_transactions():
        formatted_data.append({
            "invoice_no": t["invoice_no"],
            "source": "ERP",
            "trade_type": t["trade_type"],
            "financials": {"total_value": t["qty"] * t["rate"]},
            "shipment": {
                "destination_location": t["destination"],
                "origin_location": t["origin"],
                "port": t.get("port")
            }
        })

    # Add portal shipment state records to improve anomaly and delay detection.
    for s in db_get_portal_shipments():
        formatted_data.append({
            "invoice_no": s["invoice_no"],
            "source": "PORTAL",
            "trade_type": "UNKNOWN",
            "financials": {"total_value": 0},
            "shipment": {
                "port": s.get("port"),
                "destination_location": s.get("port"),
                "clearance_status": s.get("clearance_status")
            }
        })
    # Add a purposely discrepant record from 'PDF'
    formatted_data.append({
        "invoice_no": "LOG-EXP-2026-002",
        "source": "PDF",
        "trade_type": "EXPORT",
        "financials": {"total_value": 850000}, # ERP has 1.5M (1000 * 1500)
        "shipment": {"destination_location": "Dubai"}
    })
    
    report = run_audit(formatted_data)
    report["generated_at"] = datetime.datetime.now().isoformat(timespec="seconds")
    return report

# ─── ElevenLabs Text-to-Speech Endpoint ───────────────────────────────────────
class TTSRequest(BaseModel):
    text: str
    lang: Optional[str] = "en-IN"

@app.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    """
    Converts text to speech using ElevenLabs API.
    Returns audio/mpeg stream.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="ELEVENLABS_API_KEY not configured in .env")

    # Pick voice based on language preference (English/Tamil/Hindi).
    lang_code = (req.lang or "en-IN").lower()
    if lang_code.startswith("ta"):
        voice_id_key = "ELEVENLABS_VOICE_ID_TAMIL"
        fallback_voice = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    elif lang_code.startswith("hi"):
        voice_id_key = "ELEVENLABS_VOICE_ID_HINDI"
        fallback_voice = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    else:
        # Allow a dedicated Indian English voice if configured.
        voice_id_key = "ELEVENLABS_VOICE_ID_EN_IN"
        fallback_voice = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    voice_id = os.getenv(voice_id_key, fallback_voice)

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg"
    }
    payload = {
        "text": req.text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75
        }
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"ElevenLabs API error: {response.text}"
                )
            # Stream the audio back to the browser
            audio_bytes = response.content
            return StreamingResponse(
                iter([audio_bytes]),
                media_type="audio/mpeg",
                headers={"Content-Disposition": "inline; filename=response.mp3"}
            )
    except HTTPException:
        # Preserve upstream status/details (e.g., ElevenLabs auth or quota errors).
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="ElevenLabs API timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS internal error: {e}")

@app.post("/api/order")
def create_order(order: Order):
    invoice_no = insert_order_transaction(order.client_name, order.item, order.qty, order.rate)
    return {"status": "success", "invoice_no": invoice_no}


@app.get("/api/vector/status")
def vector_status():
    return ensure_vector_sync_with_operational_data()


@app.post("/api/vector/rebuild")
def rebuild_vector_index():
    indexed = sync_vector_from_operational_data(reset=True)
    stats = get_vector_db_stats()
    return {"status": "success", "indexed_records": indexed, **stats}


@app.get("/api/storage/status")
def storage_status():
    status = get_storage_status()
    # Keep storage status and vector DB state aligned with current operational records.
    status["chroma"] = ensure_vector_sync_with_operational_data()
    return status


@app.post("/api/ingest/excel")
def trigger_excel_ingestion(req: IngestRequest = IngestRequest()):
    path = resolve_repo_path(req.file_path, DEFAULT_EXCEL_PATH)
    rows = ingest_excel(path)
    transformed = [apply_mdm(transform_excel_record(r)) for r in rows]
    save_to_data_lake(transformed, reset=False)
    record_ingestion_run("excel", "Connected", len(transformed), f"File: {path}")
    return {"status": "success", "source": "EXCEL", "file": path, "records": len(transformed)}


@app.post("/api/ingest/excel/upload")
async def trigger_excel_upload(file: UploadFile = File(...)):
    saved_path = save_uploaded_file(file, (".xlsx", ".xls"))
    result = trigger_excel_ingestion(IngestRequest(file_path=saved_path))
    return {**result, "uploaded_file": saved_path}


@app.post("/api/ingest/erp")
def trigger_erp_ingestion():
    rows = db_get_erp_transactions()
    transformed = [apply_mdm(transform_erp_record(r)) for r in rows]
    if transformed:
        save_to_data_lake(transformed, reset=False)
    record_ingestion_run("erp", "Connected", len(transformed), "Synced from ERP endpoint")
    return {"status": "success", "source": "ERP", "records": len(transformed)}


@app.post("/api/ingest/portal")
def trigger_portal_ingestion():
    rows = db_get_portal_shipments()
    transformed = [apply_mdm(transform_portal_record(r)) for r in rows]
    if transformed:
        save_to_data_lake(transformed, reset=False)
    record_ingestion_run("portal", "Connected", len(transformed), "Synced from portal endpoint")
    return {"status": "success", "source": "PORTAL", "records": len(transformed)}


@app.post("/api/ingest/pdf")
def trigger_pdf_ingestion(req: IngestRequest = IngestRequest()):
    pattern = resolve_repo_path(req.file_glob, DEFAULT_PDF_GLOB)
    pdf_files = glob.glob(pattern)
    transformed = []

    for file_path in pdf_files:
        text, _tables = extract_pdf_text_and_tables(file_path)
        payload = parse_trade_document(text, _tables, os.path.basename(file_path))
        if not payload.get("invoice_no"):
            payload["invoice_no"] = f"PDF-{uuid.uuid4().hex[:8]}"
        if not payload.get("client_name"):
            payload["client_name"] = "Document Client"
        if not payload.get("date"):
            payload["date"] = datetime.date.today().strftime("%Y-%m-%d")
        if not payload.get("item"):
            payload["item"] = "Document Shipment"
        transformed.append(apply_mdm(transform_pdf_record(payload)))

    if transformed:
        save_to_data_lake(transformed, reset=False)
    record_ingestion_run("pdf", "Connected", len(transformed), f"Files scanned: {len(pdf_files)}")
    return {"status": "success", "source": "PDF", "files": len(pdf_files), "records": len(transformed)}


@app.post("/api/ingest/pdf/upload")
async def trigger_pdf_upload(file: UploadFile = File(...)):
    saved_path = save_uploaded_file(file, (".pdf",))
    result = trigger_pdf_ingestion(IngestRequest(file_glob=saved_path))
    return {**result, "uploaded_file": saved_path}


@app.post("/api/ingest/email")
def trigger_email_ingestion(req: IngestRequest = IngestRequest()):
    username = req.username or os.getenv("EMAIL_USERNAME", "")
    app_password = req.app_password or os.getenv("EMAIL_APP_PASSWORD", "")
    if not username or not app_password:
        record_ingestion_run("email", "Error", 0, "Missing email credentials")
        return {
            "status": "error",
            "source": "EMAIL",
            "message": "Missing EMAIL_USERNAME or EMAIL_APP_PASSWORD in .env (or request body).",
            "records": 0,
        }

    try:
        emails = ingest_unseen_emails(username, app_password)
    except Exception as e:
        record_ingestion_run("email", "Error", 0, f"IMAP ingestion failed: {e}")
        return {
            "status": "error",
            "source": "EMAIL",
            "message": f"IMAP ingestion failed: {e}",
            "records": 0,
        }

    transformed = [apply_mdm(transform_email_record(e)) for e in emails]
    if transformed:
        save_to_data_lake(transformed, reset=False)
        mirror_unified_to_erp_transactions(transformed, default_trade_type="DOMESTIC")
    record_ingestion_run("email", "Connected", len(transformed), "IMAP sync complete")
    return {"status": "success", "source": "EMAIL", "records": len(transformed)}


@app.post("/api/ingest/all")
def trigger_all_ingestion(req: IngestRequest = IngestRequest()):
    def safe_run(label: str, runner):
        try:
            return runner()
        except Exception as exc:
            record_ingestion_run(label, "Error", 0, str(exc))
            return {"status": "error", "source": label.upper(), "records": 0, "message": str(exc)}

    erp_result = safe_run("erp", trigger_erp_ingestion)
    portal_result = safe_run("portal", trigger_portal_ingestion)
    excel_result = safe_run("excel", lambda: trigger_excel_ingestion(req))
    pdf_result = safe_run("pdf", lambda: trigger_pdf_ingestion(req))
    email_result = safe_run("email", lambda: trigger_email_ingestion(req))
    all_ok = all(r.get("status") == "success" for r in [erp_result, portal_result, excel_result, pdf_result, email_result])
    sync_master_data_from_operational_records()
    return {
        "status": "success" if all_ok else "partial",
        "results": {
            "erp": erp_result,
            "portal": portal_result,
            "excel": excel_result,
            "pdf": pdf_result,
            "email": email_result,
        },
        "summary": {
            "erp_records": erp_result.get("records", 0),
            "portal_records": portal_result.get("records", 0),
            "excel_records": excel_result.get("records", 0),
            "pdf_records": pdf_result.get("records", 0),
            "email_records": email_result.get("records", 0),
            "total_records": erp_result.get("records", 0) + portal_result.get("records", 0) + excel_result.get("records", 0) + pdf_result.get("records", 0) + email_result.get("records", 0),
        },
    }


@app.get("/api/export/report")
def export_report(role: str = "super"):
    tx = db_get_erp_transactions()
    if role == "export":
        tx = [t for t in tx if (t.get("trade_type") or "").upper() == "EXPORT"]
    elif role == "import":
        tx = [t for t in tx if (t.get("trade_type") or "").upper() == "IMPORT"]
    elif role == "domestic":
        tx = [t for t in tx if (t.get("trade_type") or "").upper() == "DOMESTIC"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["invoice_no", "client_name", "trade_type", "item", "qty", "rate", "total_value", "date", "origin", "destination", "port"])
    for t in tx:
        qty = float(t.get("qty") or 0)
        rate = float(t.get("rate") or 0)
        writer.writerow([
            t.get("invoice_no"),
            t.get("client_name"),
            t.get("trade_type"),
            t.get("item"),
            qty,
            rate,
            round(qty * rate, 2),
            t.get("date"),
            t.get("origin"),
            t.get("destination"),
            t.get("port"),
        ])

    csv_bytes = output.getvalue().encode("utf-8")
    output.close()
    filename = f"trade_report_{role}_{datetime.date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/{full_path:path}", response_class=HTMLResponse)
def serve_react_app(full_path: str):
    # Catch-all must be registered last so API routes match first.
    if full_path.startswith("api/") or full_path.startswith("erp/") or full_path.startswith("portal/"):
        raise HTTPException(status_code=404)

    build_index = os.path.join("frontend", "dist", "index.html")
    if os.path.exists(build_index):
        with open(build_index, "r", encoding="utf-8") as f:
            return f.read()

    return """
    <html>
        <body style="font-family: sans-serif; padding: 2rem; background: #0f2042; color: white;">
            <h1>OmniLogix React App</h1>
            <p>React build not found. Please run <code>npm run build</code> in the <code>frontend</code> directory.</p>
            <p><a href="/erp/transactions" style="color: #4c9aff;">View Raw ERP API</a></p>
        </body>
    </html>
    """
