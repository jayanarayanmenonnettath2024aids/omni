def _infer_email_trade_type(raw):
    text = " ".join([
        str(raw.get("subject") or ""),
        str(raw.get("body") or ""),
        str(raw.get("item") or ""),
    ]).lower()

    if "export shipment invoice generated" in text or "export" in text:
        return "EXPORT"
    if "import shipment arrival notice" in text or "import" in text:
        return "IMPORT"
    if "local delivery confirmation" in text or "local" in text or "domestic" in text:
        return "DOMESTIC"
    return "DOMESTIC"


def transform_erp_record(raw):
    # Ensure quantity and unit_price are somewhat handled if None
    quantity = int(raw.get("qty") or 0)
    unit_price = float(raw.get("rate") or 0)
    
    return {
        "source": "ERP",
        "document_type": "INVOICE",
        "invoice_no": raw.get("invoice_no"),
        "customer": {
            "name": raw.get("client_name"),
            "gst_number": raw.get("gst_id"),
            "country": "India"
        },
        "product": {
            "name": raw.get("item"),
            "category": raw.get("category"),
            "hs_code": raw.get("hs_code")
        },
        "transaction": {
            "quantity": quantity,
            "unit_price": unit_price,
            "total_value": quantity * unit_price,
            "transaction_date": raw.get("date"),
            "trade_type": raw.get("trade_type")
        },
        "shipment": {
            "origin_location": raw.get("origin"),
            "destination_location": raw.get("destination"),
            "port": raw.get("port"),
            "customs_duty": raw.get("customs_duty")
        }
    }

def transform_portal_record(raw):
    return {
        "source": "PORTAL",
        "document_type": "SHIPMENT_BILL",
        "invoice_no": raw.get("invoice_no"),
        "shipment": {
            "shipping_bill_no": raw.get("shipping_bill_no"),
            "port": raw.get("port"),
            "clearance_status": raw.get("clearance_status"),
            "clearance_date": raw.get("clearance_date")
        }
    }

def transform_email_record(raw):
    trade_type = (raw.get("trade_type") or _infer_email_trade_type(raw)).upper()
    return {
        "source": "EMAIL",
        "document_type": "INVOICE",
        "invoice_no": raw.get("invoice_no"),
        "trade_type": trade_type,
        "customer": {
            "name": raw.get("client_name"),
            "gst_number": raw.get("gst_id")
        },
        "transaction": {
            "total_value": float(raw.get("amount", 0)),
            "transaction_date": raw.get("date"),
            "trade_type": trade_type,
            "quantity": int(raw.get("qty", 1) or 1),
            "unit_price": float(raw.get("amount", 0) or 0),
        }
    }

def transform_pdf_record(raw):
    trade_type = (raw.get("trade_type") or "DOMESTIC").upper()
    quantity = int(raw.get("qty") or 1)
    total_value = float(raw.get("amount") or 0)
    unit_price = total_value / quantity if quantity else total_value
    return {
        "source": "PDF",
        "document_type": raw.get("document_type") or "INVOICE",
        "invoice_no": raw.get("invoice_no"),
        "trade_type": trade_type,
        "customer": {
            "name": raw.get("client_name"),
            "gst_number": raw.get("gst_id"),
        },
        "product": {
            "name": raw.get("item"),
            "category": raw.get("category"),
        },
        "transaction": {
            "total_value": total_value,
            "transaction_date": raw.get("date"),
            "quantity": quantity,
            "unit_price": unit_price,
            "trade_type": trade_type,
        },
        "shipment": {
            "origin_location": raw.get("origin"),
            "destination_location": raw.get("destination"),
            "port": raw.get("port"),
            "customs_duty": raw.get("customs_duty"),
            "product_description": raw.get("item"),
        },
    }

def transform_excel_record(raw):
    return {
        "source": "EXCEL",
        "document_type": "SHIPMENT_MANIFEST",
        "invoice_no": raw.get("invoice_no"),
        "customer": {
            "name": raw.get("client"),
        },
        "transaction": {
            "total_value": float(raw.get("total_value", 0)),
            "quantity": int(raw.get("qty", 0)),
            "transaction_date": raw.get("date")
        },
        "shipment": {
            "route": raw.get("route"),
            "transport_mode": raw.get("transport_mode")
        }
    }
