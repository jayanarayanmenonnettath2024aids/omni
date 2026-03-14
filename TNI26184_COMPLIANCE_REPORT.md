# TNI26184 Compliance Report

Date: 2026-03-14
Project: Trade-Data
Validation Runner: run_compliance_tests.py

## Executive Status

Core compliance status: PASS

External integration caveat:
- Lyzr live voice provider endpoint currently returns upstream 404 on all tested session start/end routes from the configured host.
- This does not block TNI26184 core requirements (data ingestion, data quality, unified model, MDM, OCR+NLP, ETL automation, analytics dashboarding).

## Requirement Mapping

### 1) Data ingestion pipelines that read from documents, APIs, and databases

Implementation evidence:
- API ingestion endpoints: /api/ingest/erp, /api/ingest/portal, /api/ingest/excel, /api/ingest/pdf, /api/ingest/email, /api/ingest/all
- Upload endpoints: /api/ingest/excel/upload, /api/ingest/pdf/upload
- API sources: ERP and Portal APIs
- Document sources: PDF and spreadsheet ingestion
- Database sources: SQLite operational store with PostgreSQL mirror

Validation evidence (latest run):
- ERP ingestion: PASS (records=25)
- Portal ingestion: PASS (records=15)
- Excel ingestion: PASS (records=10)
- PDF ingestion: PASS (records=2)
- Full ingestion orchestration: PASS (total_records=52)
- Upload ingestion: PASS (excel_status=200, pdf_status=200)

### 2) Data cleaning, deduplication, and entity resolution

Implementation evidence:
- MDM pipeline via apply_mdm and canonical entity registration
- Persisted MDM governance tables:
  - master_entities
  - master_entity_aliases
  - mdm_resolution_log
- Dedup guard on unified model:
  - unique index on (invoice_no, source)
  - replace/update semantics during ingestion

Validation evidence (latest run):
- Unified model and dedup: PASS
  - sources={'ERP': 25, 'EXCEL': 10, 'PDF': 4, 'PORTAL': 15}
  - dedup_stable=True
- MDM status: PASS
  - entities={'customer': 42, 'location': 45, 'product': 35}
  - resolution_count=12402

### 3) Unified data model for analytics and reporting

Implementation evidence:
- Unified lake table: unified_trade
- Required analytics fields present:
  - invoice_no, client_name, item, qty, rate, total_value, date, trade_type, origin, destination, source
- ETL transforms normalize ERP/Portal/PDF/Email/Excel into common schema blocks

Validation evidence (latest run):
- Unified model and dedup: PASS
- Analytics stats: PASS (labels=6, values=6)
- CSV export: PASS (csv_rows=9)

### 4) ETL tools to pull data regularly from key sources

Implementation evidence:
- APScheduler-based periodic ETL in backend startup
- ETL controls and visibility:
  - /api/pipeline/status
  - /api/pipeline/sync

Validation evidence (latest run):
- Pipeline status: PASS (enabled=True, interval=30)
- Full ingestion orchestration: PASS

### 5) OCR + NLP for documents (Invoices, BoL, Packing Lists)

Implementation evidence:
- PDF extraction with OCR fallback path
- Document parser infers and extracts trade fields and document type
- Supported doc-type detection includes:
  - INVOICE
  - BILL_OF_ENTRY
  - BILL_OF_LADING
  - PACKING_LIST

Validation evidence (latest run):
- OCR and document NLP: PASS
  - invoice_document_type=INVOICE
  - invoice_amount=900000.0
  - bill_of_entry_document_type=BILL_OF_ENTRY
  - packing_list_document_type=PACKING_LIST
  - bill_of_lading_document_type=BILL_OF_LADING

### 6) Master Data Management (customers, products, locations)

Implementation evidence:
- Persistent MDM governance in DB
- Startup + ingestion-time master sync from operational records
- Resolution logging with confidence

Validation evidence (latest run):
- MDM status: PASS
  - entities populated for customer, product, location
  - resolution_count > 0
- PostgreSQL mirror check: PASS (unified_trade=54, master_entities=106)

### 7) BI/custom dashboards exposure

Implementation evidence:
- Role-specific dashboard endpoint: /api/dashboard/data?role=...
- Analytics endpoint: /api/analytics/stats
- Export endpoint: /api/export/report
- Frontend app served from backend root

Validation evidence (latest run):
- Frontend shell: PASS
- Dashboard data: PASS
- Role dashboards: PASS (export/import/domestic filtering verified)
- Analytics stats: PASS
- CSV export: PASS

## Additional System Checks (Non-TNI core but validated)

- Authentication flow: PASS
- AI chat endpoint: PASS
- Audit + anomaly report: PASS
- Vector status + rebuild: PASS
- Storage health endpoint: PASS
- TTS integration: PASS
- Live voice session integration: WARN (provider endpoint unavailable)

## Known Remaining Risk

- Live voice agent provider endpoint currently returns 404 for tested session routes at configured host.
- Backend now supports route overrides via env:
  - LYZR_VOICE_SESSION_START_PATH
  - LYZR_VOICE_SESSION_END_PATH
- Once provider confirms account/region-specific paths, set these vars and re-run compliance.

## How To Reproduce

1. Run: run_all_tests.bat
2. Or run only compliance: python run_compliance_tests.py
3. Check detailed server traces: compliance_uvicorn.log
