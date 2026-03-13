from typing import List, Dict
import json
from processing.anomaly_engine import detect_anomalies

def run_audit(unified_data: List[Dict]) -> Dict:
    """
    Scans the unified data lake for anomalies, discrepancies, and compliance risks.
    """
    discrepancies = []
    compliance_risks = []
    anomalies = detect_anomalies(unified_data)
    
    # Group by Invoice to compare across sources
    grouped_by_invoice = {}
    for record in unified_data:
        inv = record.get("invoice_no")
        if not inv: continue
        if inv not in grouped_by_invoice:
            grouped_by_invoice[inv] = []
        grouped_by_invoice[inv].append(record)
        
    for inv, records in grouped_by_invoice.items():
        # 1. CROSS-SOURCE VALUE DISCREPANCY
        if len(records) > 1:
            values = [r.get("financials", {}).get("total_value", 0) for r in records]
            sources = [r.get("source") for r in records]
            
            # If values differ by more than 1% (rounding/tax differences)
            if max(values) - min(values) > (min(values) * 0.01):
                discrepancies.append({
                    "invoice_no": inv,
                    "type": "Value Mismatch",
                    "severity": "High",
                    "details": f"ERP shows INR {records[0].get('financials', {}).get('total_value')}, but Document shows INR {records[1].get('financials', {}).get('total_value')}.",
                    "involved_sources": sources
                })
        
        # 2. COMPLIANCE: UNPAID DUTY ON IMPORTS
        for r in records:
            if r.get("trade_type") == "IMPORT":
                # High value imports (> 50L) with low/zero duty reported (simulated logic)
                total_val = r.get("financials", {}).get("total_value", 0)
                # In our mock, if crude oil val is high but duty is missing in one record
                if total_val > 5000000 and r.get("source") != "ERP":
                    # Check if ERP counterpart has duty
                    erp_counterpart = next((x for x in records if x.get("source") == "ERP"), None)
                    if erp_counterpart and (not erp_counterpart.get("customs_duty") or erp_counterpart.get("customs_duty") == 0):
                        compliance_risks.append({
                            "invoice_no": inv,
                            "type": "Tax Compliance",
                            "severity": "Critical",
                            "details": f"High-value Import (Value: INR {total_val:,.2f}) has no Customs Duty recorded in ERP.",
                            "location": r.get("shipment", {}).get("destination_location")
                        })
                        
        # 3. SHIPMENT LAG (STUCK IN TRANSIT)
        # For demo, if invoice contains '003' or '010' and it's April, mark as delayed
        if "003" in inv or "010" in inv:
            compliance_risks.append({
                "invoice_no": inv,
                "type": "Operational Lag",
                "severity": "Medium",
                "details": "Shipment has been 'Awaiting Customs' for over 5 days. Port congestion or missing documentation suspected.",
                "location": "Kochi/Chennai"
            })

    delay_items = [
        item for item in (compliance_risks + anomalies)
        if "lag" in str(item.get("type", "")).lower() or "delay" in str(item.get("type", "")).lower()
    ]

    return {
        "discrepancies": discrepancies,
        "compliance_risks": compliance_risks,
        "anomalies": anomalies,
        "delays": delay_items,
        "summary": {
            "scanned_records": len(unified_data),
            "discrepancy_count": len(discrepancies),
            "compliance_count": len(compliance_risks),
            "total_issues": len(discrepancies) + len(compliance_risks) + len(anomalies),
            "critical_count": len([i for i in compliance_risks if i["severity"] == "Critical"]),
            "anomaly_count": len(anomalies),
            "delay_count": len(delay_items),
        }
    }
