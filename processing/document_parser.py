import re
from typing import Any, Dict, List, Optional

GST_RE = re.compile(r'\b\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d]\b')
INVOICE_RE = re.compile(r'\b(?:LOG|MAIL)-[A-Z]{3}-\d{4}-[A-Z0-9]{3,}\b')
DATE_RE = re.compile(r'\b(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})\b')
AMOUNT_RE = re.compile(r'(?:INR|Rs\.?|Amount|Total(?:\s+Amount)?)\s*[:=\-]?\s*([0-9,]+(?:\.\d{1,2})?)', re.IGNORECASE)
DUTY_RE = re.compile(r'(?:Customs\s+Duty|Duty)\s*[:=\-]?\s*([0-9,]+(?:\.\d{1,2})?)', re.IGNORECASE)
QTY_RE = re.compile(r'(?:Qty|Quantity)\s*[:=\-]?\s*(\d+(?:\.\d+)?)', re.IGNORECASE)


def _compact(text: str) -> str:
    return re.sub(r'\s+', ' ', str(text or '')).strip()


def _first_match(pattern: re.Pattern, text: str) -> Optional[str]:
    match = pattern.search(text or '')
    if not match:
        return None
    return _compact(match.group(1) if match.lastindex else match.group(0))


def _field_after_label(text: str, labels: List[str]) -> Optional[str]:
    for label in labels:
        pattern = re.compile(rf'{label}\s*[:=\-]\s*([^\n\r]+)', re.IGNORECASE)
        match = pattern.search(text or '')
        if match:
            return _compact(match.group(1))
    return None


def _extract_line_item_metrics(line: str) -> Dict[str, Optional[str]]:
    compact_line = _compact(line)
    metrics = {
        'item': None,
        'quantity': None,
        'amount': None,
    }
    if not compact_line:
        return metrics

    metric_match = re.search(
        r'^(?P<item>.+?)\s+(?P<quantity>\d+(?:\.\d+)?)\s+(?:containers|units|pieces|kgs|kg|mt|tons|ton)?\s*(?P<rate>[0-9,]+(?:\.\d+)?)\s+(?P<amount>[0-9,]+(?:\.\d+)?)$',
        compact_line,
        re.IGNORECASE,
    )
    if metric_match:
        metrics['item'] = _compact(metric_match.group('item'))
        metrics['quantity'] = metric_match.group('quantity')
        metrics['amount'] = metric_match.group('amount')
    return metrics


def _field_between_labels(text: str, labels: List[str], stop_labels: List[str]) -> Optional[str]:
    stop_expr = '|'.join(re.escape(label) for label in stop_labels)
    for label in labels:
        pattern = re.compile(rf'{re.escape(label)}\s*[:=\-]?\s*(.+?)(?=(?:{stop_expr})\s*[:=\-]|$)', re.IGNORECASE)
        match = pattern.search(text or '')
        if match:
            return _compact(match.group(1))
    return None


def infer_trade_type(text: str) -> str:
    lower = (text or '').lower()
    invoice_match = _first_match(INVOICE_RE, text or '') or ''
    if '-EXP-' in invoice_match:
        return 'EXPORT'
    if '-IMP-' in invoice_match:
        return 'IMPORT'
    if '-INV-' in invoice_match:
        return 'DOMESTIC'
    if any(token in lower for token in ['bill of entry', 'import', 'consignee', 'arrival notice']):
        return 'IMPORT'
    if any(token in lower for token in ['export', 'shipping bill', 'shipper', 'packing list']):
        return 'EXPORT'
    return 'DOMESTIC'


def infer_document_type(text: str) -> str:
    lower = (text or '').lower()
    if 'bill of lading' in lower or 'bol' in lower:
        return 'BILL_OF_LADING'
    if 'packing list' in lower:
        return 'PACKING_LIST'
    if 'bill of entry' in lower:
        return 'BILL_OF_ENTRY'
    if 'license' in lower:
        return 'LICENSE'
    return 'INVOICE'


def parse_trade_document(text: str, tables: Optional[List[Any]] = None, file_name: str = '') -> Dict[str, Any]:
    raw_text = str(text or '')
    full_text = _compact(raw_text)
    lines = [_compact(line) for line in raw_text.splitlines() if _compact(line)]
    joined_tables = []
    for table in tables or []:
        try:
            for row in table or []:
                joined_tables.append(' '.join(_compact(cell) for cell in row if cell))
        except Exception:
            continue
    corpus = _compact(' '.join([full_text, ' '.join(joined_tables), file_name]))

    invoice_no = None
    date = None
    grand_total = None
    client_name = None
    item = None
    line_item_quantity = None
    line_item_amount = None

    for line in lines:
        if invoice_no is None:
            invoice_no = _field_after_label(line, ['Invoice No', 'Invoice Number', 'Ref No', 'Document No']) or _first_match(INVOICE_RE, line)
        if date is None:
            labelled_date = _field_after_label(line, ['Invoice Date', 'Document Date', 'Date'])
            if labelled_date and DATE_RE.search(labelled_date):
                date = DATE_RE.search(labelled_date).group(1)
            elif DATE_RE.search(line):
                date = DATE_RE.search(line).group(1)
        if grand_total is None:
            grand_total = _field_after_label(line, ['Grand Total', 'Invoice Value', 'Total Amount'])

    for idx, line in enumerate(lines):
        lower = line.lower()
        if any(label in lower for label in ['billed to', 'customer', 'client', 'consignee', 'buyer']):
            same_line_value = _field_after_label(line, ['Billed To', 'Customer', 'Client', 'Consignee', 'Buyer'])
            if same_line_value:
                client_name = same_line_value
                break
            collected = []
            for follow in lines[idx + 1: idx + 4]:
                follow_lower = follow.lower()
                if any(stop in follow_lower for stop in ['description', 'invoice', 'date', 'qty', 'rate', 'total', 'gst', 'port']):
                    break
                collected.append(follow)
            if collected:
                client_name = _compact(' '.join(collected))
                break

    for idx, line in enumerate(lines):
        if 'description' in line.lower() and idx + 1 < len(lines):
            candidate = lines[idx + 1]
            metrics = _extract_line_item_metrics(candidate)
            if metrics['item']:
                item = metrics['item']
                line_item_quantity = metrics['quantity']
                line_item_amount = metrics['amount']
                break
            candidate = re.sub(r'\s+\d+(?:\.\d+)?\s*(?:containers|units|pieces|kgs|kg|mt)?\s+[0-9,]+(?:\.\d+)?\s+[0-9,]+(?:\.\d+)?$', '', candidate, flags=re.IGNORECASE).strip()
            if candidate:
                item = candidate
                break

    gst_number = _field_after_label(corpus, ['GST', 'GSTIN']) or _first_match(GST_RE, corpus)
    amount = grand_total or line_item_amount or _field_after_label(corpus, ['Amount']) or _first_match(AMOUNT_RE, corpus)
    quantity = line_item_quantity or _field_after_label(corpus, ['Qty', 'Quantity']) or _first_match(QTY_RE, corpus)
    duty = _field_after_label(corpus, ['Customs Duty', 'Duty']) or _first_match(DUTY_RE, corpus)
    origin = _field_after_label(corpus, ['Origin', 'From'])
    destination = _field_after_label(corpus, ['Destination', 'Deliver To', 'Ship To'])
    port = _field_after_label(corpus, ['Port', 'Port Of Loading', 'Port Of Discharge'])

    trade_type = infer_trade_type(corpus)
    if destination is None and client_name and trade_type == 'EXPORT':
        destination = client_name
    if origin is None and client_name and trade_type == 'IMPORT':
        origin = client_name

    def to_number(value: Optional[str]) -> float:
        if value is None:
            return 0.0
        try:
            normalized = str(value).replace(',', '').strip()
            numeric_match = re.search(r'(-?\d+(?:\.\d+)?)', normalized)
            if numeric_match:
                return float(numeric_match.group(1))
            return float(normalized)
        except Exception:
            return 0.0

    return {
        'invoice_no': invoice_no,
        'client_name': client_name,
        'gst_id': gst_number,
        'item': item,
        'amount': to_number(amount),
        'date': date,
        'qty': int(to_number(quantity) or 0),
        'customs_duty': to_number(duty),
        'origin': origin,
        'destination': destination,
        'port': port,
        'trade_type': trade_type,
        'document_type': infer_document_type(corpus),
        'raw_text': corpus,
    }
