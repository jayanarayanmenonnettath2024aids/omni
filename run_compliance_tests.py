import compileall
import contextlib
import csv
import io
import json
import os
import sqlite3
import subprocess
import sys
import time
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = BASE_DIR / "frontend"
DB_PATH = BASE_DIR / "data" / "trade_data_lake.db"
SERVER_URL = "http://127.0.0.1:8000"

# Ensure subprocesses and in-process checks share the same .env values.
load_dotenv(BASE_DIR / ".env", override=True)


def print_result(name: str, passed: bool, detail: str, level: str = "CHECK") -> bool:
    status = "PASS" if passed else "FAIL"
    print(f"[{level}:{status}] {name}: {detail}")
    return passed


def print_warn(name: str, detail: str) -> None:
    print(f"[WARN] {name}: {detail}")


def wait_for_server(timeout_seconds: int = 90) -> bool:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            response = requests.get(f"{SERVER_URL}/erp/transactions", timeout=3)
            if response.status_code == 200:
                return True
        except requests.RequestException:
            pass
        time.sleep(1)
    return False


def run_command(command: list[str], cwd: Path) -> tuple[bool, str]:
    resolved_command = command[:]
    if os.name == "nt" and command and command[0].lower() == "npm":
        resolved_command[0] = "npm.cmd"
    try:
        completed = subprocess.run(
            resolved_command,
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=600,
            check=False,
        )
    except Exception as exc:
        return False, str(exc)

    output = (completed.stdout or "") + (completed.stderr or "")
    output = output.strip().replace("\n", " ")
    if len(output) > 240:
        output = output[:240] + "..."
    return completed.returncode == 0, output or f"exit_code={completed.returncode}"


def parse_pdf_document(pdf_path: Path) -> dict:
    from ingestion.pdf_ingest import extract_pdf_text_and_tables
    from processing.document_parser import parse_trade_document

    text, tables = extract_pdf_text_and_tables(str(pdf_path))
    return parse_trade_document(text, tables, pdf_path.name)


def parse_text_document(sample_text: str, file_name: str) -> dict:
    from processing.document_parser import parse_trade_document

    return parse_trade_document(sample_text, [], file_name)


def get_unified_trade_snapshot() -> dict:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) AS count FROM unified_trade")
    total_records = int(cur.fetchone()["count"])
    cur.execute("SELECT source, COUNT(*) AS count FROM unified_trade GROUP BY source ORDER BY source")
    source_counts = {str(row["source"]): int(row["count"]) for row in cur.fetchall()}
    cur.execute("PRAGMA table_info(unified_trade)")
    columns = [row[1] for row in cur.fetchall()]
    conn.close()
    return {
        "total_records": total_records,
        "source_counts": source_counts,
        "columns": columns,
    }


def check_dashboard_filters(session: requests.Session) -> tuple[bool, str]:
    role_expectations = {
        "export": "EXPORT",
        "import": "IMPORT",
        "domestic": "DOMESTIC",
    }

    for role, expected in role_expectations.items():
        response = session.get(f"{SERVER_URL}/api/dashboard/data", params={"role": role}, timeout=30)
        if response.status_code != 200:
            return False, f"role={role}, status={response.status_code}"
        payload = response.json()
        transactions = payload.get("transactions", [])
        if not transactions:
            return False, f"role={role}, returned no transactions"
        if any((row.get("trade_type") or "").upper() != expected for row in transactions):
            return False, f"role={role}, filter leaked other trade types"
    return True, "export/import/domestic role filters returned only expected trade types"


def check_auth_flow(session: requests.Session) -> tuple[bool, str]:
    user_id = f"compliance_{uuid.uuid4().hex[:8]}"
    payload = {
        "user_id": user_id,
        "password": "Compliance@123",
        "display_name": "Compliance User",
        "role": "domestic",
    }
    register_response = session.post(f"{SERVER_URL}/api/auth/register", json=payload, timeout=30)
    if register_response.status_code != 200:
        return False, f"register_status={register_response.status_code}, body={register_response.text[:160]}"

    login_response = session.post(
        f"{SERVER_URL}/api/auth/login",
        json={"user_id": user_id, "password": payload["password"]},
        timeout=30,
    )
    if login_response.status_code != 200:
        return False, f"login_status={login_response.status_code}, body={login_response.text[:160]}"
    data = login_response.json()
    return bool(data.get("role") == "domestic"), f"registered_and_logged_in={user_id}"


def check_csv_export(session: requests.Session) -> tuple[bool, str]:
    response = session.get(f"{SERVER_URL}/api/export/report", params={"role": "export"}, timeout=30)
    if response.status_code != 200:
        return False, f"status={response.status_code}, body={response.text[:160]}"
    if "text/csv" not in response.headers.get("content-type", ""):
        return False, f"unexpected_content_type={response.headers.get('content-type', '')}"
    rows = list(csv.reader(io.StringIO(response.text)))
    return len(rows) > 1, f"csv_rows={len(rows)}"


def check_document_parsing() -> tuple[bool, str]:
    invoice = parse_pdf_document(BASE_DIR / "data" / "realistic_trade_invoice.pdf")
    bill_of_entry = parse_pdf_document(BASE_DIR / "data" / "import_bill_of_entry_03.pdf")
    packing_list = parse_text_document(
        """
        PACKING LIST
        Invoice No: PKL-2026-014
        Date: 2026-03-10
        Shipper: Global Textile Exports Pvt Ltd
        Consignee: Nordic Retail AB
        Description
        Premium Cotton Yarn 120 800 96000
        """,
        "packing_list_sample.txt",
    )
    bill_of_lading = parse_text_document(
        """
        BILL OF LADING
        Invoice No: BOL-2026-009
        Date: 2026-03-09
        Shipper: Oceanic Imports Ltd
        Consignee: Chennai Port Terminal
        Description
        Industrial Batteries 45 42000 1890000
        """,
        "bill_of_lading_sample.txt",
    )

    invoice_ok = (
        invoice.get("invoice_no") == "LOG-EXP-2026-002"
        and invoice.get("document_type") == "INVOICE"
        and int(invoice.get("qty") or 0) == 2
        and float(invoice.get("amount") or 0) == 900000.0
    )
    bill_ok = bill_of_entry.get("document_type") == "BILL_OF_ENTRY"
    packing_ok = packing_list.get("document_type") == "PACKING_LIST"
    bol_ok = bill_of_lading.get("document_type") == "BILL_OF_LADING"
    all_ok = invoice_ok and bill_ok and packing_ok and bol_ok
    detail = json.dumps(
        {
            "invoice_document_type": invoice.get("document_type"),
            "invoice_amount": invoice.get("amount"),
            "bill_of_entry_document_type": bill_of_entry.get("document_type"),
            "packing_list_document_type": packing_list.get("document_type"),
            "bill_of_lading_document_type": bill_of_lading.get("document_type"),
        }
    )
    return all_ok, detail


def check_unified_model_and_dedup(session: requests.Session) -> tuple[bool, str]:
    before = get_unified_trade_snapshot()
    erp_before = before["source_counts"].get("ERP", 0)
    session.post(f"{SERVER_URL}/api/ingest/erp", timeout=60)
    session.post(f"{SERVER_URL}/api/ingest/erp", timeout=60)
    after = get_unified_trade_snapshot()
    erp_after = after["source_counts"].get("ERP", 0)
    required_columns = {
        "invoice_no",
        "client_name",
        "item",
        "qty",
        "rate",
        "total_value",
        "date",
        "trade_type",
        "origin",
        "destination",
        "source",
    }
    columns_ok = required_columns.issubset(set(after["columns"]))
    dedup_ok = erp_before == erp_after
    enough_sources = len([source for source, count in after["source_counts"].items() if count > 0]) >= 4
    passed = columns_ok and dedup_ok and enough_sources and after["total_records"] > 0
    return passed, f"sources={after['source_counts']}, dedup_stable={dedup_ok}, columns_ok={columns_ok}"


def check_postgres_mirror() -> tuple[bool, str, bool]:
    enabled = os.getenv("POSTGRES_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
    if not enabled:
        return True, "POSTGRES_ENABLED=false; mirror check skipped", True

    try:
        import psycopg2
    except Exception as exc:
        return False, f"psycopg2 unavailable: {exc}", False

    config = {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "dbname": os.getenv("POSTGRES_DB", "trade_data_lake"),
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", ""),
    }
    if not config["password"]:
        return False, "POSTGRES_PASSWORD missing while Postgres mirror is enabled", False

    try:
        try:
            conn = psycopg2.connect(**config)
        except Exception as exc:
            exc_text = str(exc).lower()
            if getattr(exc, "pgcode", None) == "3D000" or "does not exist" in exc_text:
                admin_cfg = dict(config)
                admin_cfg["dbname"] = os.getenv("POSTGRES_ADMIN_DB", "postgres")
                admin_conn = psycopg2.connect(**admin_cfg)
                admin_conn.autocommit = True
                admin_cur = admin_conn.cursor()
                db_name = str(config["dbname"]).replace('"', '""')
                admin_cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (config["dbname"],))
                if admin_cur.fetchone() is None:
                    admin_cur.execute(f'CREATE DATABASE "{db_name}"')
                admin_conn.close()
                conn = psycopg2.connect(**config)
            else:
                raise
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM unified_trade")
        unified_count = int(cur.fetchone()[0])
        cur.execute("SELECT COUNT(*) FROM master_entities")
        entities_count = int(cur.fetchone()[0])
        conn.close()
        passed = unified_count > 0 and entities_count > 0
        return passed, f"unified_trade={unified_count}, master_entities={entities_count}", False
    except Exception as exc:
        return False, f"postgres connection/query failed: {exc}", False


def check_upload_endpoints(session: requests.Session) -> tuple[bool, str]:
    excel_path = BASE_DIR / "data" / "logistics_shipments.xlsx"
    pdf_path = BASE_DIR / "data" / "realistic_trade_invoice.pdf"
    with excel_path.open("rb") as excel_file:
        excel_response = session.post(
            f"{SERVER_URL}/api/ingest/excel/upload",
            files={"file": (excel_path.name, excel_file, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=120,
        )
    with pdf_path.open("rb") as pdf_file:
        pdf_response = session.post(
            f"{SERVER_URL}/api/ingest/pdf/upload",
            files={"file": (pdf_path.name, pdf_file, "application/pdf")},
            timeout=120,
        )

    excel_ok = excel_response.status_code == 200 and excel_response.json().get("records", 0) > 0
    pdf_ok = pdf_response.status_code == 200 and pdf_response.json().get("records", 0) > 0
    return excel_ok and pdf_ok, f"excel_status={excel_response.status_code}, pdf_status={pdf_response.status_code}"


def check_core_api_suite(session: requests.Session) -> list[tuple[str, bool, str]]:
    results = []

    response = session.get(f"{SERVER_URL}/", timeout=30)
    results.append(("Frontend shell", response.status_code == 200 and "<html" in response.text.lower(), f"status={response.status_code}"))

    response = session.get(f"{SERVER_URL}/api/ingestion/connectors", timeout=30)
    connectors = response.json().get("connectors", []) if response.status_code == 200 else []
    results.append(("Connector status", response.status_code == 200 and len(connectors) >= 4, f"status={response.status_code}, connectors={len(connectors)}"))

    response = session.get(f"{SERVER_URL}/api/pipeline/status", timeout=30)
    data = response.json() if response.status_code == 200 else {}
    results.append(("Pipeline status", response.status_code == 200 and bool(data.get("enabled")) and int(data.get("interval_minutes") or 0) >= 5, f"status={response.status_code}, enabled={data.get('enabled')}, interval={data.get('interval_minutes')}"))

    response = session.get(f"{SERVER_URL}/api/mdm/status", timeout=30)
    data = response.json() if response.status_code == 200 else {}
    entities = data.get("entities", {}) if isinstance(data, dict) else {}
    results.append(("MDM status", response.status_code == 200 and sum(int(v) for v in entities.values()) > 0 and int(data.get("resolution_count") or 0) > 0, f"status={response.status_code}, entities={entities}, resolution_count={data.get('resolution_count')}"))

    response = session.get(f"{SERVER_URL}/api/vector/status", timeout=120)
    data = response.json() if response.status_code == 200 else {}
    indexed = int(data.get("indexed_records") or data.get("record_count") or 0)
    results.append(("Vector status", response.status_code == 200 and indexed > 0, f"status={response.status_code}, indexed={indexed}"))

    response = session.post(f"{SERVER_URL}/api/vector/rebuild", timeout=180)
    data = response.json() if response.status_code == 200 else {}
    results.append(("Vector rebuild", response.status_code == 200 and int(data.get("indexed_records") or 0) > 0, f"status={response.status_code}, indexed={data.get('indexed_records')}"))

    response = session.get(f"{SERVER_URL}/api/storage/status", timeout=120)
    data = response.json() if response.status_code == 200 else {}
    chroma = data.get("chroma", {}) if isinstance(data, dict) else {}
    results.append(("Storage status", response.status_code == 200 and bool(data.get("sqlite")) and int(chroma.get("indexed_records") or chroma.get("record_count") or 0) > 0, f"status={response.status_code}, sqlite={data.get('sqlite')}, chroma={chroma}"))

    response = session.get(f"{SERVER_URL}/api/analytics/stats", params={"role": "super"}, timeout=60)
    data = response.json() if response.status_code == 200 else {}
    results.append(("Analytics stats", response.status_code == 200 and len(data.get("labels", [])) > 0 and len(data.get("values", [])) > 0, f"status={response.status_code}, labels={len(data.get('labels', []))}, values={len(data.get('values', []))}"))

    response = session.get(f"{SERVER_URL}/api/audit/report", timeout=180)
    data = response.json() if response.status_code == 200 else {}
    summary = data.get("summary", {}) if isinstance(data, dict) else {}
    results.append(("Audit and anomaly", response.status_code == 200 and int(summary.get("scanned_records") or 0) > 0 and int(summary.get("anomaly_count") or 0) > 0, f"status={response.status_code}, summary={summary}"))

    response = session.post(f"{SERVER_URL}/api/ai/chat", json={"message": "show current trade picture", "lang": "en-IN"}, timeout=60)
    data = response.json() if response.status_code == 200 else {}
    results.append(("AI chat", response.status_code == 200 and bool(str(data.get("answer", "")).strip()), f"status={response.status_code}, answer_preview={str(data.get('answer', ''))[:100]}"))

    response = session.post(f"{SERVER_URL}/api/order", json={"client_name": "Compliance Buyer", "item": "Routers", "qty": 4, "rate": 12500}, timeout=30)
    data = response.json() if response.status_code == 200 else {}
    results.append(("Order creation", response.status_code == 200 and data.get("status") == "success" and bool(data.get("invoice_no")), f"status={response.status_code}, invoice_no={data.get('invoice_no')}"))

    response = session.get(f"{SERVER_URL}/api/dashboard/data", params={"role": "super"}, timeout=60)
    data = response.json() if response.status_code == 200 else {}
    results.append(("Dashboard data", response.status_code == 200 and len(data.get("transactions", [])) > 0 and len(data.get("shipments", [])) > 0, f"status={response.status_code}, tx={len(data.get('transactions', []))}, shipments={len(data.get('shipments', []))}"))

    return results


def check_source_ingestion(session: requests.Session) -> list[tuple[str, bool, str]]:
    results = []
    for path, label, payload in [
        ("/api/ingest/erp", "ERP ingestion", None),
        ("/api/ingest/portal", "Portal ingestion", None),
        ("/api/ingest/excel", "Excel ingestion", {"file_path": "data/logistics_shipments.xlsx"}),
        ("/api/ingest/pdf", "PDF ingestion", {"file_glob": "data/*.pdf"}),
    ]:
        response = session.post(f"{SERVER_URL}{path}", json=payload, timeout=180)
        data = response.json() if response.status_code == 200 else {}
        records = int(data.get("records") or data.get("summary", {}).get("total_records") or 0)
        results.append((label, response.status_code == 200 and records > 0, f"status={response.status_code}, records={records}"))

    email_response = session.post(f"{SERVER_URL}/api/ingest/email", json={}, timeout=180)
    email_ok = email_response.status_code == 200 and email_response.json().get("status") in {"success", "error"}
    email_detail = f"status={email_response.status_code}, payload={email_response.text[:180]}"
    results.append(("Email ingestion endpoint", email_ok, email_detail))

    all_response = session.post(f"{SERVER_URL}/api/ingest/all", json={}, timeout=240)
    all_data = all_response.json() if all_response.status_code == 200 else {}
    total_records = int((all_data.get("summary") or {}).get("total_records") or 0)
    overall_status = all_data.get("status")
    results.append(("Full ingestion orchestration", all_response.status_code == 200 and overall_status in {"success", "partial"} and total_records > 0, f"status={all_response.status_code}, orchestration_status={overall_status}, total_records={total_records}"))
    return results


def check_external_integrations(session: requests.Session) -> list[tuple[str, bool, str, bool]]:
    results = []

    tts_response = session.post(
        f"{SERVER_URL}/api/tts",
        json={"text": "Compliance test", "lang": "en-IN"},
        headers={"Accept": "audio/mpeg"},
        timeout=60,
    )
    tts_ok = tts_response.status_code == 200 and len(tts_response.content) > 0
    results.append(("TTS integration", tts_ok, f"status={tts_response.status_code}, content_type={tts_response.headers.get('content-type', '')}, body={tts_response.text[:120] if not tts_ok else ''}", True))

    start_response = session.post(f"{SERVER_URL}/api/voice-agent/session/start", json={}, timeout=60)
    start_ok = start_response.status_code == 200
    detail = f"status={start_response.status_code}"
    if start_ok:
        payload = start_response.json()
        room_name = payload.get("roomName") or payload.get("room_name") or ""
        detail = f"status=200, room_name={room_name}"
        if room_name:
            end_response = session.post(f"{SERVER_URL}/api/voice-agent/session/end", json={"room_name": room_name}, timeout=60)
            start_ok = start_ok and end_response.status_code == 200
            detail = f"start_status=200, end_status={end_response.status_code}, room_name={room_name}"
    else:
        detail = f"status={start_response.status_code}, body={start_response.text[:180]}"
    results.append(("Live voice integration", start_ok, detail, True))
    return results


def main() -> int:
    print("=== Trade-Data Compliance Test Runner ===")
    core_passed = True

    compiled_ok = compileall.compile_dir(str(BASE_DIR), quiet=1)
    core_passed &= print_result("Python compile", compiled_ok, "compileall completed")

    frontend_ok, frontend_detail = run_command(["npm", "run", "build"], FRONTEND_DIR)
    core_passed &= print_result("Frontend build", frontend_ok, frontend_detail)

    python_exe = sys.executable
    log_path = BASE_DIR / "compliance_uvicorn.log"
    with log_path.open("w", encoding="utf-8") as log_file:
        server_process = subprocess.Popen(
            [
                python_exe,
                "-m",
                "uvicorn",
                "erp_mock:app",
                "--host",
                "127.0.0.1",
                "--port",
                "8000",
            ],
            cwd=str(BASE_DIR),
            stdout=log_file,
            stderr=subprocess.STDOUT,
            env=os.environ.copy(),
        )

    try:
        ready = wait_for_server()
        core_passed &= print_result("API startup", ready, "server ready" if ready else "server did not start in time")
        if not ready:
            print(f"Check {log_path} for startup logs.")
            return 1

        session = requests.Session()

        for name, passed, detail in check_core_api_suite(session):
            core_passed &= print_result(name, passed, detail)

        dashboard_ok, dashboard_detail = check_dashboard_filters(session)
        core_passed &= print_result("Role dashboards", dashboard_ok, dashboard_detail)

        auth_ok, auth_detail = check_auth_flow(session)
        core_passed &= print_result("Auth flow", auth_ok, auth_detail)

        for name, passed, detail in check_source_ingestion(session):
            core_passed &= print_result(name, passed, detail)

        upload_ok, upload_detail = check_upload_endpoints(session)
        core_passed &= print_result("Upload ingestion", upload_ok, upload_detail)

        unified_ok, unified_detail = check_unified_model_and_dedup(session)
        core_passed &= print_result("Unified model and dedup", unified_ok, unified_detail)

        pg_ok, pg_detail, pg_soft = check_postgres_mirror()
        if pg_ok:
            core_passed &= print_result("PostgreSQL mirror", True, pg_detail)
        elif pg_soft:
            print_warn("PostgreSQL mirror", pg_detail)
        else:
            core_passed &= print_result("PostgreSQL mirror", False, pg_detail)

        csv_ok, csv_detail = check_csv_export(session)
        core_passed &= print_result("CSV export", csv_ok, csv_detail)

        parser_ok, parser_detail = check_document_parsing()
        core_passed &= print_result("OCR and document NLP", parser_ok, parser_detail)

        for name, passed, detail, soft in check_external_integrations(session):
            if passed:
                print_result(name, True, detail, level="EXTERNAL")
            elif soft:
                print_warn(name, detail)
            else:
                core_passed &= print_result(name, False, detail, level="EXTERNAL")

    finally:
        server_process.terminate()
        with contextlib.suppress(subprocess.TimeoutExpired):
            server_process.wait(timeout=20)
        if server_process.poll() is None:
            server_process.kill()

    print("=== Summary ===")
    if core_passed:
        print("All core compliance checks passed.")
        print(f"See {log_path} for server logs if you need full request traces.")
        return 0

    print("One or more core compliance checks failed.")
    print(f"See {log_path} for server logs.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())