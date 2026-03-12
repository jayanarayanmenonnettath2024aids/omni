from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import List, Dict
import datetime
from processing.ai_assistant import get_ai_response
from processing.audit import run_audit
from main import run_pipeline
import sqlite3
import os

app = FastAPI()

class Order(BaseModel):
    client_name: str
    item: str
    qty: int
    rate: float

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

@app.get("/", response_class=HTMLResponse)
def erp_dashboard():
    # Adding a couple more mock rows for better visual density
    extended_transactions = MOCK_TRANSACTIONS + [
        {
            "invoice_no": "LOG-EXP-2026-008",
            "client_name": "Nordic Solutions",
            "gst_id": "33NORD9900F1Z4",
            "item": "Auto Parts - 5 Containers",
            "category": "Automotive",
            "hs_code": "8708",
            "qty": 5,
            "rate": 45000,
            "date": "2026-04-02",
            "trade_type": "EXPORT",
            "origin": "Chennai",
            "destination": "Oslo",
            "port": "Chennai Port",
            "customs_duty": 0
        },
        {
            "invoice_no": "LOG-INV-2026-009",
            "client_name": "Reliance Retail",
            "gst_id": "27REL1234F1Z9",
            "item": "Apparel & Textiles",
            "category": "Retail",
            "hs_code": None,
            "qty": 500,
            "rate": 120,
            "date": "2026-04-03",
            "trade_type": "DOMESTIC",
            "origin": "Surat",
            "destination": "Bangalore",
            "port": None,
            "customs_duty": None
        }
    ]

    # Generate table rows dynamically
    rows = ""
    for t in extended_transactions:
        type_class = ""
        if t['trade_type'] == "DOMESTIC":
            type_class = "bg-blue-100 text-blue-800 border-blue-200"
        elif t['trade_type'] == "EXPORT":
            type_class = "bg-emerald-100 text-emerald-800 border-emerald-200"
        else:
            type_class = "bg-amber-100 text-amber-800 border-amber-200"

        value = f"₹{(t['qty'] * t['rate']):,.2f}"
        rows += f'''
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="py-4 px-6 text-sm font-semibold text-slate-800">{t['invoice_no']}</td>
            <td class="py-4 px-6 text-sm text-slate-600 font-medium">{t['client_name']}</td>
            <td class="py-4 px-6 text-sm"><span class="px-3 py-1 text-xs font-semibold rounded-full border {type_class}">{t['trade_type']}</span></td>
            <td class="py-4 px-6 text-sm text-slate-600 truncate max-w-xs">{t['item']}</td>
            <td class="py-4 px-6 text-sm text-slate-500">{t['date']}</td>
            <td class="py-4 px-6 text-sm text-slate-800 font-medium text-right">{value}</td>
            <td class="py-4 px-6 text-center text-slate-400 hover:text-indigo-600 cursor-pointer"><i class="fas fa-ellipsis-v"></i></td>
        </tr>
        '''
        
    shipment_rows = ""
    for s in MOCK_SHIPMENTS:
        status_color = "bg-emerald-100 text-emerald-800 border-emerald-200" if "Cleared" in s['clearance_status'] else "bg-amber-100 text-amber-800 border-amber-200"
        icon = "fa-check-circle" if "Cleared" in s['clearance_status'] else "fa-clock"
        shipment_rows += f'''
        <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="py-4 px-6 text-sm font-semibold text-slate-800">{s['invoice_no']}</td>
            <td class="py-4 px-6 text-sm text-slate-600">{s['shipping_bill_no']}</td>
            <td class="py-4 px-6 text-sm text-slate-600"><div class="flex items-center"><i class="fas fa-anchor text-slate-400 mr-2"></i>{s['port']}</div></td>
            <td class="py-4 px-6 text-sm"><span class="px-3 py-1 text-xs font-semibold rounded-full border {status_color} flex items-center inline-flex"><i class="fas {icon} mr-1"></i>{s['clearance_status']}</span></td>
            <td class="py-4 px-6 text-sm text-slate-500">{s['clearance_date']}</td>
        </tr>
        '''

    import os
    file_path = os.path.join(os.path.dirname(__file__), "dashboard.html")
    with open(file_path, "r", encoding="utf-8") as f:
        html_content = f.read()

    # Inject the dynamic rows into the HTML template placeholders
    html_content = html_content.replace("<!--ROWS_PLACEHOLDER-->", rows)
    html_content = html_content.replace("<!--SHIPMENTS_PLACEHOLDER-->", shipment_rows)

    return html_content

@app.get("/erp/transactions")
def get_transactions() -> List[Dict]:
    return MOCK_TRANSACTIONS

@app.get("/portal/shipments")
def get_portal_shipments() -> List[Dict]:
    return MOCK_SHIPMENTS

@app.post("/api/ai/chat")
def ai_chat(query: Dict):
    user_text = query.get("message", "")
    lang = query.get("lang", "en-IN")
    return get_ai_response(user_text, lang)

@app.get("/api/analytics/stats")
def get_stats(role: str = "super"):
    # Filter based on role
    filtered_transactions = MOCK_TRANSACTIONS
    if role == "export":
        filtered_transactions = [t for t in MOCK_TRANSACTIONS if t['trade_type'] == "EXPORT"]
    elif role == "import":
        filtered_transactions = [t for t in MOCK_TRANSACTIONS if t['trade_type'] == "IMPORT"]
    elif role == "domestic":
        filtered_transactions = [t for t in MOCK_TRANSACTIONS if t['trade_type'] == "DOMESTIC"]
        
    product_counts = {}
    for t in filtered_transactions:
        # Simple parsing to get the base product name
        item = t['item'].lower()
        product = "Other"
        if "laptop" in item: product = "Laptops"
        elif "semiconductor" in item or "chip" in item: product = "Semiconductors"
        elif "oil" in item: product = "Crude Oil"
        elif "yarn" in item: product = "Yarn"
        elif "spice" in item: product = "Spices"
        
        product_counts[product] = product_counts.get(product, 0) + (t['qty'] * t['rate'])

    return {
        "total_value": sum(product_counts.values()),
        "distribution": product_counts,
        "labels": list(product_counts.keys()),
        "values": [round(v/100000, 2) for v in product_counts.values()] # In Lakhs
    }

@app.post("/api/pipeline/sync")
def trigger_sync():
    try:
        results = run_pipeline()
        return {"status": "success", "summary": results}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/audit/report")
def get_audit():
    # Run the pipeline to get the current state of the data lake
    # In a real app, this would query the Postgres DB
    lake_summary = run_pipeline()
    # We need the actual records, not just summary. 
    # Let's modify main.py to optionally return the records or just mock the input for now
    # For the sake of the demo, I'll use the MOCK_TRANSACTIONS and wrap them in the expected structure
    formatted_data = []
    for t in MOCK_TRANSACTIONS:
        formatted_data.append({
            "invoice_no": t["invoice_no"],
            "source": "ERP",
            "trade_type": t["trade_type"],
            "financials": {"total_value": t["qty"] * t["rate"]},
            "shipment": {"destination_location": t["destination"]}
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
    return report

@app.post("/api/order")
def create_order(order: Order):
    invoice_no = f"LOG-INV-{datetime.date.today().year}-00{len(MOCK_TRANSACTIONS) + 10}"
    new_transaction = {
        "invoice_no": invoice_no,
        "client_name": order.client_name,
        "gst_id": f"33{order.client_name[:4].upper().replace(' ', '')}9999F1Z1",
        "item": order.item,
        "category": "General Merchandise",
        "hs_code": None,
        "qty": order.qty,
        "rate": order.rate,
        "date": datetime.date.today().strftime("%Y-%m-%d"),
        "trade_type": "DOMESTIC",
        "origin": "Web Storefront",
        "destination": "Client Location",
        "port": None,
        "customs_duty": None
    }
    MOCK_TRANSACTIONS.append(new_transaction)
    return {"status": "success", "invoice_no": invoice_no}