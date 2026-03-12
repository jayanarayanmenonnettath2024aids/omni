import os
import pandas as pd
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def create_synthetic_pdf():
    os.makedirs("data", exist_ok=True)
    pdf_path = "data/realistic_trade_invoice.pdf"
    
    # Create a simple PDF mimicking an invoice
    c = canvas.Canvas(pdf_path, pagesize=letter)
    
    c.setFont("Helvetica-Bold", 20)
    c.drawString(50, 750, "TAX INVOICE")
    
    c.setFont("Helvetica", 12)
    c.drawString(50, 720, "Global Logistics Solutions Ltd.")
    c.drawString(50, 705, "123 Port Road, Chennai, Tamil Nadu")
    
    c.drawString(300, 720, "Invoice No: LOG-EXP-2026-002")
    c.drawString(300, 705, "Date: 2026-03-29")
    
    c.line(50, 680, 550, 680)
    
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, 650, "Billed To:")
    c.setFont("Helvetica", 12)
    c.drawString(50, 630, "Dubai Textile Hub")
    c.drawString(50, 615, "Jebel Ali, Dubai, UAE")
    
    c.drawString(50, 550, "Description")
    c.drawString(300, 550, "Qty")
    c.drawString(400, 550, "Rate (INR)")
    c.drawString(500, 550, "Total (INR)")
    c.line(50, 545, 550, 545)
    
    c.drawString(50, 520, "Premium Cotton Yarn - Grade A")
    c.drawString(300, 520, "2 containers")
    c.drawString(400, 520, "450000")
    c.drawString(500, 520, "900000.00")
    
    c.line(50, 480, 550, 480)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(400, 460, "Grand Total: INR 900000.00")
    
    c.save()
    print(f"Created synthetic Export PDF at {pdf_path}")

def create_synthetic_import_pdf():
    os.makedirs("data", exist_ok=True)
    pdf_path = "data/import_bill_of_entry_03.pdf"
    
    c = canvas.Canvas(pdf_path, pagesize=letter)
    
    c.setFont("Helvetica-Bold", 16)
    c.drawString(200, 750, "BILL OF ENTRY FOR HOME CONSUMPTION")
    
    c.setFont("Helvetica", 10)
    c.drawString(50, 720, "Port of Import: KOCHI (INCOK1)")
    c.drawString(50, 705, "Importer Name: OCEANIC IMPORTERS PVT LTD")
    c.drawString(350, 720, "BOE No: 8899221 / 2026")
    c.drawString(350, 705, "Date: 2026-04-01")
    
    c.line(50, 690, 550, 690)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 670, "Supplier:")
    c.setFont("Helvetica", 10)
    c.drawString(50, 655, "Abu Dhabi National Oil Company (ADNOC)")
    c.drawString(50, 640, "Abu Dhabi, United Arab Emirates")
    
    # Table Header
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 600, "Description of Goods")
    c.drawString(250, 600, "HS Code")
    c.drawString(320, 600, "Qty (Metric Tons)")
    c.drawString(450, 600, "Assessable Value (INR)")
    c.line(50, 595, 550, 595)
    
    c.setFont("Helvetica", 10)
    c.drawString(50, 575, "Brent Crude Oil - High Octane")
    c.drawString(250, 575, "27090000")
    c.drawString(320, 575, "1,200 MT")
    c.drawString(450, 575, "8,000,000.00")
    
    c.line(50, 550, 550, 550)
    
    c.setFont("Helvetica-Bold", 10)
    c.drawString(50, 530, "Duty Calculation:")
    c.setFont("Helvetica", 10)
    c.drawString(50, 515, "Basic Customs Duty (BCD): 5%")
    c.drawString(50, 500, "Social Welfare Surcharge: 10% of BCD")
    c.drawString(350, 515, "Total Duty Payable: INR 440,000.00")
    
    c.save()
    print(f"Created synthetic Import PDF at {pdf_path}")

def create_synthetic_excel():
    os.makedirs("data", exist_ok=True)
    excel_path = "data/logistics_shipments.xlsx"
    
    data = [
        {
            "invoice_no": "LOG-INV-2026-001",
            "client": "Vajra Logistics",
            "date": "2026-03-28",
            "route": "Chennai -> Bangalore",
            "qty": 50,
            "unit": "boxes",
            "total_value": 45000,
            "item": "Laptops",
            "transport_mode": "Road"
        },
        {
            "invoice_no": "LOG-IMP-2026-003",
            "client": "Oceanic Importers",
            "date": "2026-04-01",
            "route": "UAE -> Kochi Port",
            "qty": 2,
            "unit": "containers",
            "total_value": 3200000,
            "item": "Crude Oil",
            "transport_mode": "Sea"
        },
        {
            "invoice_no": "LOG-INV-2026-010",
            "client": "TechCorp Ind.",
            "date": "2026-04-02",
            "route": "Mumbai -> Delhi",
            "qty": 100,
            "unit": "units",
            "total_value": 150000,
            "item": "Semiconductors",
            "transport_mode": "Train"
        },
        {
            "invoice_no": "LOG-EXP-2026-011",
            "client": "ABC Textiles Pvt Ltd",
            "date": "2026-04-03",
            "route": "Tiruppur -> Dubai",
            "qty": 5,
            "unit": "containers",
            "total_value": 8500000,
            "item": "Yarn",
            "transport_mode": "Sea"
        },
        {
            "invoice_no": "LOG-INV-2026-012",
            "client": "Spice Bazaar",
            "date": "2026-04-04",
            "route": "Kochi -> Chennai",
            "qty": 500,
            "unit": "bags",
            "total_value": 95000,
            "item": "Spices",
            "transport_mode": "Road"
        },
        {
            "invoice_no": "LOG-IMP-2026-013",
            "client": "Metro Retailers",
            "date": "2026-04-05",
            "route": "Shenzhen -> Mumbai Port",
            "qty": 1,
            "unit": "container",
            "total_value": 4500000,
            "item": "Laptops",
            "transport_mode": "Sea"
        },
        {
            "invoice_no": "LOG-INV-2026-014",
            "client": "Tata Motors",
            "date": "2026-04-06",
            "route": "Pune -> Bangalore",
            "qty": 20,
            "unit": "pallets",
            "total_value": 1200000,
            "item": "Semiconductors",
            "transport_mode": "Road"
        },
        {
            "invoice_no": "LOG-EXP-2026-015",
            "client": "Nordic Solutions",
            "date": "2026-04-07",
            "route": "Chennai -> Oslo",
            "qty": 10,
            "unit": "containers",
            "total_value": 25000000,
            "item": "Yarn",
            "transport_mode": "Sea"
        },
        {
            "invoice_no": "LOG-INV-2026-016",
            "client": "Global Knit Exports",
            "date": "2026-04-08",
            "route": "Coimbatore -> Mumbai",
            "qty": 150,
            "unit": "bales",
            "total_value": 750000,
            "item": "Yarn",
            "transport_mode": "Train"
        },
        {
            "invoice_no": "LOG-INV-2026-017",
            "client": "Spice King",
            "date": "2026-04-09",
            "route": "Delhi -> Kolkata",
            "qty": 80,
            "unit": "sacks",
            "total_value": 340000,
            "item": "Spices",
            "transport_mode": "Road"
        }
    ]
    
    df = pd.DataFrame(data)
    df.to_excel(excel_path, index=False)
    print(f"Created synthetic Excel at {excel_path}")

if __name__ == "__main__":
    create_synthetic_pdf()
    create_synthetic_import_pdf()
    create_synthetic_excel()
