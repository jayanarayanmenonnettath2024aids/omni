from statistics import median
from typing import Any, Dict, List


def _extract_total_value(record: Dict[str, Any]) -> float:
    transaction_val = (record.get("transaction") or {}).get("total_value")
    financial_val = (record.get("financials") or {}).get("total_value")
    value = transaction_val if transaction_val is not None else financial_val
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def detect_anomalies(unified_data: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    anomalies: List[Dict[str, Any]] = []
    grouped: Dict[str, List[Dict[str, Any]]] = {}

    for record in unified_data:
        invoice_no = record.get("invoice_no")
        if not invoice_no:
            continue
        grouped.setdefault(invoice_no, []).append(record)

    numeric_values = [_extract_total_value(r) for r in unified_data]
    numeric_values = [v for v in numeric_values if v > 0]
    baseline = median(numeric_values) if numeric_values else 0.0

    for invoice_no, records in grouped.items():
        for record in records:
            source = str(record.get("source", "UNKNOWN"))
            shipment = record.get("shipment") or {}
            value = _extract_total_value(record)
            location = shipment.get("destination_location") or shipment.get("port") or "N/A"

            if value <= 0 and source in {"ERP", "PDF", "EXCEL"}:
                anomalies.append(
                    {
                        "invoice_no": invoice_no,
                        "type": "Data Quality",
                        "severity": "Medium",
                        "details": f"{source} record has missing or zero transaction value.",
                        "location": location,
                    }
                )

            if baseline > 0 and value > max(1000000, baseline * 2.75):
                anomalies.append(
                    {
                        "invoice_no": invoice_no,
                        "type": "Value Outlier",
                        "severity": "High",
                        "details": f"Value INR {value:,.2f} is significantly above baseline INR {baseline:,.2f}.",
                        "location": location,
                    }
                )

            clearance = str(shipment.get("clearance_status", "")).lower()
            if any(token in clearance for token in ["awaiting", "pending", "verification"]):
                anomalies.append(
                    {
                        "invoice_no": invoice_no,
                        "type": "Shipment Delay Risk",
                        "severity": "Medium",
                        "details": f"Clearance status is '{shipment.get('clearance_status')}', which suggests delay risk.",
                        "location": location,
                    }
                )

        values = [_extract_total_value(r) for r in records if _extract_total_value(r) > 0]
        if len(values) >= 2:
            low = min(values)
            high = max(values)
            if low > 0 and (high / low) >= 1.35:
                anomalies.append(
                    {
                        "invoice_no": invoice_no,
                        "type": "Cross-Source Variance",
                        "severity": "High",
                        "details": f"Cross-source value spread is high (min INR {low:,.2f}, max INR {high:,.2f}).",
                        "location": "Cross-source",
                    }
                )

    # De-duplicate by essential fields to keep UI readable.
    deduped: List[Dict[str, Any]] = []
    seen = set()
    for item in anomalies:
        key = (item.get("invoice_no"), item.get("type"), item.get("details"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)

    return deduped
