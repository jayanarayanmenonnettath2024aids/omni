import imaplib
import email
import os
import re
from datetime import datetime
import uuid
from email.header import decode_header

DOWNLOAD_FOLDER = "data/email_pdfs"


def extract_invoice_from_text(text):
    invoice = {}

    invoice_no = re.search(r"Invoice\s*No[:\-]?\s*(\S+)", text, re.IGNORECASE)
    client = re.search(r"Client[:\-]?\s*(.+)", text, re.IGNORECASE)
    gst = re.search(r"GST[:\-]?\s*(\S+)", text, re.IGNORECASE)
    amount = re.search(r"Amount[:\-]?\s*(\d+)", text, re.IGNORECASE)
    date = re.search(r"Date[:\-]?\s*([\d\-\/]+)", text, re.IGNORECASE)

    if invoice_no:
        invoice["invoice_no"] = invoice_no.group(1)
    if client:
        invoice["client_name"] = client.group(1).strip()
    if gst:
        invoice["gst_id"] = gst.group(1)
    if amount:
        invoice["amount"] = amount.group(1)
    if date:
        invoice["date"] = date.group(1)

    return invoice


def ingest_unseen_emails(username, app_password):
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(username, app_password)
    mail.select("inbox")

    status, messages = mail.search(None, "UNSEEN")

    if not os.path.exists(DOWNLOAD_FOLDER):
        os.makedirs(DOWNLOAD_FOLDER)

    extracted_invoices = []

    for num in messages[0].split():
        status, msg_data = mail.fetch(num, "(RFC822)")

        for response_part in msg_data:
            if isinstance(response_part, tuple):
                msg = email.message_from_bytes(response_part[1])

                subject, encoding = decode_header(msg["Subject"])[0]
                if isinstance(subject, bytes):
                    subject = subject.decode(encoding or "utf-8")

                body = ""
                has_invoice_keyword = False

                if msg.is_multipart():
                    for part in msg.walk():
                        content_type = part.get_content_type()
                        content_disposition = str(part.get("Content-Disposition"))

                        # Extract body
                        if content_type == "text/plain":
                            body = part.get_payload(decode=True).decode(errors="ignore")

                        # Download PDF attachments
                        if "attachment" in content_disposition:
                            filename = part.get_filename()
                            if filename and filename.endswith(".pdf"):
                                filepath = os.path.join(DOWNLOAD_FOLDER, filename)
                                with open(filepath, "wb") as f:
                                    f.write(part.get_payload(decode=True))
                                print(f"Saved PDF: {filepath}")

                else:
                    body = msg.get_payload(decode=True).decode(errors="ignore")

                lowered = f"{subject} {body}".lower()
                business_keywords = [
                    "invoice",
                    "shipment",
                    "export",
                    "import",
                    "local delivery",
                    "arrival notice",
                    "delivery confirmation",
                ]
                # Ignore unrelated emails
                if not any(k in lowered for k in business_keywords):
                    continue

                # Extract invoice data from body
                invoice_data = extract_invoice_from_text(body)

                # Fallback extraction for operational shipment notifications.
                if not invoice_data:
                    sender = (msg.get("From") or "unknown@local").split("<")[0].strip().strip('"')
                    client_name = sender.split("@")[0].replace(".", " ").title() if "@" in sender else sender
                    amount_match = re.search(r"(?:inr|rs\.?|amount)\s*[:\-]?\s*([0-9,]+(?:\.\d+)?)", lowered, re.IGNORECASE)
                    amount_val = float(amount_match.group(1).replace(",", "")) if amount_match else 0.0
                    date_match = re.search(r"(\d{4}[\-/]\d{2}[\-/]\d{2})", lowered)
                    parsed_date = date_match.group(1).replace("/", "-") if date_match else datetime.now().strftime("%Y-%m-%d")

                    subject_clean = re.sub(r"\s+", " ", subject).strip()
                    prefix = "INV"
                    s_low = subject_clean.lower()
                    if "export" in s_low:
                        prefix = "EXP"
                    elif "import" in s_low or "arrival" in s_low:
                        prefix = "IMP"
                    elif "local" in s_low or "delivery" in s_low:
                        prefix = "LOC"

                    invoice_data = {
                        "invoice_no": f"MAIL-{prefix}-{uuid.uuid4().hex[:8].upper()}",
                        "client_name": client_name or "Email Client",
                        "amount": amount_val,
                        "date": parsed_date,
                    }

                invoice_data["subject"] = subject
                invoice_data["body"] = body[:2000]

                if invoice_data:
                    extracted_invoices.append(invoice_data)
                    print("Extracted Invoice:", invoice_data)

    mail.logout()
    return extracted_invoices