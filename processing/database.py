import os
import uuid
import sqlite3
from datetime import datetime
import chromadb
from chromadb.utils import embedding_functions
try:
    import psycopg2
    import psycopg2.extras
except Exception:
    psycopg2 = None

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "trade_data_lake.db")


def _pg_config():
    return {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", "5432")),
        "dbname": os.getenv("POSTGRES_DB", "trade_data_lake"),
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", ""),
    }


def _pg_enabled():
    return os.getenv("POSTGRES_ENABLED", "true").strip().lower() in ("1", "true", "yes", "on")


def _ensure_pg_database_exists(config):
    admin_cfg = dict(config)
    admin_cfg["dbname"] = os.getenv("POSTGRES_ADMIN_DB", "postgres")
    conn = psycopg2.connect(**admin_cfg)
    conn.autocommit = True
    cur = conn.cursor()
    db_name = config["dbname"]
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (db_name,))
    exists = cur.fetchone() is not None
    if not exists:
        safe_db_name = str(db_name).replace('"', '""')
        cur.execute(f'CREATE DATABASE "{safe_db_name}"')
    conn.close()


def _get_pg_conn():
    if not _pg_enabled():
        raise RuntimeError("Postgres integration disabled")
    if psycopg2 is None:
        raise RuntimeError("psycopg2 is not installed")
    config = _pg_config()
    try:
        return psycopg2.connect(**config)
    except Exception as exc:
        exc_text = str(exc).lower()
        # 3D000: invalid_catalog_name (database does not exist)
        if getattr(exc, "pgcode", None) == "3D000" or "does not exist" in exc_text:
            _ensure_pg_database_exists(config)
            return psycopg2.connect(**config)
        raise


def _init_postgres():
    conn = _get_pg_conn()
    cur = conn.cursor()
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS unified_trade (
            id SERIAL PRIMARY KEY,
            invoice_no TEXT,
            client_name TEXT,
            item TEXT,
            qty DOUBLE PRECISION,
            rate DOUBLE PRECISION,
            total_value DOUBLE PRECISION,
            date TEXT,
            trade_type TEXT,
            origin TEXT,
            destination TEXT,
            source TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_trade_invoice_source ON unified_trade (invoice_no, source)')
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS erp_transactions (
            invoice_no TEXT PRIMARY KEY,
            client_name TEXT,
            gst_id TEXT,
            item TEXT,
            category TEXT,
            hs_code TEXT,
            qty DOUBLE PRECISION,
            rate DOUBLE PRECISION,
            date TEXT,
            trade_type TEXT,
            origin TEXT,
            destination TEXT,
            port TEXT,
            customs_duty DOUBLE PRECISION,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS portal_shipments (
            shipping_bill_no TEXT PRIMARY KEY,
            invoice_no TEXT,
            port TEXT,
            clearance_status TEXT,
            clearance_date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS app_users (
            user_id TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS ingestion_runs (
            id SERIAL PRIMARY KEY,
            connector_key TEXT,
            status TEXT,
            records INTEGER,
            message TEXT,
            run_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS master_entities (
            id SERIAL PRIMARY KEY,
            entity_type TEXT,
            canonical_name TEXT,
            first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            occurrence_count INTEGER DEFAULT 1,
            UNIQUE(entity_type, canonical_name)
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS master_entity_aliases (
            id SERIAL PRIMARY KEY,
            entity_type TEXT,
            raw_value TEXT,
            canonical_name TEXT,
            confidence DOUBLE PRECISION,
            first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            occurrence_count INTEGER DEFAULT 1,
            UNIQUE(entity_type, raw_value)
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS mdm_resolution_log (
            id SERIAL PRIMARY KEY,
            entity_type TEXT,
            raw_value TEXT,
            canonical_name TEXT,
            confidence DOUBLE PRECISION,
            resolved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    conn.commit()
    conn.close()


def _get_conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS unified_trade (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT,
            client_name TEXT,
            item TEXT,
            qty REAL,
            rate REAL,
            total_value REAL,
            date TEXT,
            trade_type TEXT,
            origin TEXT,
            destination TEXT,
            source TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_unified_trade_invoice_source ON unified_trade (invoice_no, source)')
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS erp_transactions (
            invoice_no TEXT PRIMARY KEY,
            client_name TEXT,
            gst_id TEXT,
            item TEXT,
            category TEXT,
            hs_code TEXT,
            qty REAL,
            rate REAL,
            date TEXT,
            trade_type TEXT,
            origin TEXT,
            destination TEXT,
            port TEXT,
            customs_duty REAL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS portal_shipments (
            shipping_bill_no TEXT PRIMARY KEY,
            invoice_no TEXT,
            port TEXT,
            clearance_status TEXT,
            clearance_date TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS app_users (
            user_id TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS ingestion_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            connector_key TEXT,
            status TEXT,
            records INTEGER,
            message TEXT,
            run_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS master_entities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT,
            canonical_name TEXT,
            first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
            occurrence_count INTEGER DEFAULT 1,
            UNIQUE(entity_type, canonical_name)
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS master_entity_aliases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT,
            raw_value TEXT,
            canonical_name TEXT,
            confidence REAL,
            first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP,
            occurrence_count INTEGER DEFAULT 1,
            UNIQUE(entity_type, raw_value)
        )
        '''
    )
    cur.execute(
        '''
        CREATE TABLE IF NOT EXISTS mdm_resolution_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity_type TEXT,
            raw_value TEXT,
            canonical_name TEXT,
            confidence REAL,
            resolved_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
        '''
    )
    conn.commit()
    conn.close()
    try:
        _init_postgres()
    except Exception as e:
        print(f"      [POSTGRES WARNING] Could not connect/init: {e}")


def save_to_data_lake(records, reset=True):
    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    if reset:
        cur.execute("DELETE FROM unified_trade")

    for r in records or []:
        transaction = r.get("transaction", {}) or {}
        financials = r.get("financials", {}) or {}
        shipment = r.get("shipment", {}) or {}
        cur.execute(
            'DELETE FROM unified_trade WHERE invoice_no = ? AND UPPER(COALESCE(source, "")) = UPPER(COALESCE(?, ""))',
            (r.get("invoice_no"), r.get("source")),
        )
        cur.execute(
            '''
            INSERT OR REPLACE INTO unified_trade
            (invoice_no, client_name, item, qty, rate, total_value, date, trade_type, origin, destination, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                r.get("invoice_no"),
                (r.get("customer", {}) or {}).get("name"),
                shipment.get("product_description") or (r.get("product", {}) or {}).get("name"),
                shipment.get("quantity", transaction.get("quantity", 0) or 0),
                financials.get("rate", transaction.get("unit_price", 0) or 0),
                financials.get("total_value", transaction.get("total_value", 0) or 0),
                r.get("date") or transaction.get("transaction_date"),
                r.get("trade_type", transaction.get("trade_type", "DOMESTIC")),
                shipment.get("origin_location") or shipment.get("route"),
                shipment.get("destination_location"),
                r.get("source"),
            ),
        )

    conn.commit()
    conn.close()

    # Mirror structural records to PostgreSQL so analytics can use real DB storage.
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        if reset:
            pg_cur.execute("DELETE FROM unified_trade")
        for r in records or []:
            transaction = r.get("transaction", {}) or {}
            financials = r.get("financials", {}) or {}
            shipment = r.get("shipment", {}) or {}
            pg_cur.execute(
                '''
                INSERT INTO unified_trade
                (invoice_no, client_name, item, qty, rate, total_value, date, trade_type, origin, destination, source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (invoice_no, source) DO UPDATE
                SET client_name = EXCLUDED.client_name,
                    item = EXCLUDED.item,
                    qty = EXCLUDED.qty,
                    rate = EXCLUDED.rate,
                    total_value = EXCLUDED.total_value,
                    date = EXCLUDED.date,
                    trade_type = EXCLUDED.trade_type,
                    origin = EXCLUDED.origin,
                    destination = EXCLUDED.destination,
                    source = EXCLUDED.source
                ''',
                (
                    r.get("invoice_no"),
                    (r.get("customer", {}) or {}).get("name"),
                    shipment.get("product_description") or (r.get("product", {}) or {}).get("name"),
                    shipment.get("quantity", transaction.get("quantity", 0) or 0),
                    financials.get("rate", transaction.get("unit_price", 0) or 0),
                    financials.get("total_value", transaction.get("total_value", 0) or 0),
                    r.get("date") or transaction.get("transaction_date"),
                    r.get("trade_type", transaction.get("trade_type", "DOMESTIC")),
                    shipment.get("origin_location") or shipment.get("route"),
                    shipment.get("destination_location"),
                    r.get("source"),
                ),
            )
        pg.commit()
        pg.close()
    except Exception as e:
        print(f"      [POSTGRES WARNING] Data not saved to real instance: {e}")

    save_to_vector_db(records, reset=reset)


def register_master_entity(entity_type, raw_value, canonical_value, confidence=100.0):
    entity = str(entity_type or '').strip().upper()
    raw = str(raw_value or '').strip()
    canonical = str(canonical_value or '').strip()
    if not entity or not canonical:
        return

    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        '''
        INSERT INTO master_entities (entity_type, canonical_name, occurrence_count)
        VALUES (?, ?, 1)
        ON CONFLICT(entity_type, canonical_name) DO UPDATE SET
            occurrence_count = occurrence_count + 1,
            last_seen_at = CURRENT_TIMESTAMP
        ''',
        (entity, canonical),
    )
    if raw:
        cur.execute(
            '''
            INSERT INTO master_entity_aliases (entity_type, raw_value, canonical_name, confidence, occurrence_count)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(entity_type, raw_value) DO UPDATE SET
                canonical_name = excluded.canonical_name,
                confidence = excluded.confidence,
                occurrence_count = occurrence_count + 1,
                last_seen_at = CURRENT_TIMESTAMP
            ''',
            (entity, raw, canonical, float(confidence or 0)),
        )
        cur.execute(
            'INSERT INTO mdm_resolution_log (entity_type, raw_value, canonical_name, confidence) VALUES (?, ?, ?, ?)',
            (entity, raw, canonical, float(confidence or 0)),
        )
    conn.commit()
    conn.close()

    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        pg_cur.execute(
            '''
            INSERT INTO master_entities (entity_type, canonical_name, occurrence_count)
            VALUES (%s, %s, 1)
            ON CONFLICT (entity_type, canonical_name) DO UPDATE
            SET occurrence_count = master_entities.occurrence_count + 1,
                last_seen_at = CURRENT_TIMESTAMP
            ''',
            (entity, canonical),
        )
        if raw:
            pg_cur.execute(
                '''
                INSERT INTO master_entity_aliases (entity_type, raw_value, canonical_name, confidence, occurrence_count)
                VALUES (%s, %s, %s, %s, 1)
                ON CONFLICT (entity_type, raw_value) DO UPDATE
                SET canonical_name = EXCLUDED.canonical_name,
                    confidence = EXCLUDED.confidence,
                    occurrence_count = master_entity_aliases.occurrence_count + 1,
                    last_seen_at = CURRENT_TIMESTAMP
                ''',
                (entity, raw, canonical, float(confidence or 0)),
            )
            pg_cur.execute(
                'INSERT INTO mdm_resolution_log (entity_type, raw_value, canonical_name, confidence) VALUES (%s, %s, %s, %s)',
                (entity, raw, canonical, float(confidence or 0)),
            )
        pg.commit()
        pg.close()
    except Exception:
        pass


def get_master_data_stats():
    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute('SELECT entity_type, COUNT(*) AS count FROM master_entities GROUP BY entity_type')
    entity_counts = {str(row['entity_type']).lower(): int(row['count']) for row in cur.fetchall()}
    cur.execute('SELECT COUNT(*) AS count FROM mdm_resolution_log')
    resolution_count = int(cur.fetchone()['count'])
    cur.execute(
        '''
        SELECT entity_type, raw_value, canonical_name, confidence, resolved_at
        FROM mdm_resolution_log
        ORDER BY resolved_at DESC
        LIMIT 10
        '''
    )
    recent = [dict(row) for row in cur.fetchall()]
    conn.close()
    return {
        'entities': entity_counts,
        'resolution_count': resolution_count,
        'recent_resolutions': recent,
    }


def sync_master_data_from_operational_records():
    for row in get_erp_transactions():
        register_master_entity('customer', row.get('client_name'), row.get('client_name'), 100)
        register_master_entity('product', row.get('item'), row.get('item'), 100)
        register_master_entity('location', row.get('origin'), row.get('origin'), 100)
        register_master_entity('location', row.get('destination'), row.get('destination'), 100)
        register_master_entity('location', row.get('port'), row.get('port'), 100)

    for row in get_portal_shipments():
        register_master_entity('location', row.get('port'), row.get('port'), 100)


def seed_erp_transactions(rows):
    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    for t in rows or []:
        cur.execute(
            '''
            INSERT OR IGNORE INTO erp_transactions
            (invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                t.get("invoice_no"),
                t.get("client_name"),
                t.get("gst_id"),
                t.get("item"),
                t.get("category"),
                t.get("hs_code"),
                t.get("qty", 0),
                t.get("rate", 0),
                t.get("date"),
                t.get("trade_type"),
                t.get("origin"),
                t.get("destination"),
                t.get("port"),
                t.get("customs_duty"),
            ),
        )
    conn.commit()
    conn.close()
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        for t in rows or []:
            pg_cur.execute(
                '''
                INSERT INTO erp_transactions
                (invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (invoice_no) DO NOTHING
                ''',
                (
                    t.get("invoice_no"),
                    t.get("client_name"),
                    t.get("gst_id"),
                    t.get("item"),
                    t.get("category"),
                    t.get("hs_code"),
                    t.get("qty", 0),
                    t.get("rate", 0),
                    t.get("date"),
                    t.get("trade_type"),
                    t.get("origin"),
                    t.get("destination"),
                    t.get("port"),
                    t.get("customs_duty"),
                ),
            )
        pg.commit()
        pg.close()
    except Exception as e:
        print(f"      [POSTGRES WARNING] ERP seed skipped: {e}")


def seed_portal_shipments(rows):
    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    for s in rows or []:
        cur.execute(
            '''
            INSERT OR IGNORE INTO portal_shipments
            (shipping_bill_no, invoice_no, port, clearance_status, clearance_date)
            VALUES (?, ?, ?, ?, ?)
            ''',
            (
                s.get("shipping_bill_no"),
                s.get("invoice_no"),
                s.get("port"),
                s.get("clearance_status"),
                s.get("clearance_date"),
            ),
        )
    conn.commit()
    conn.close()
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        for s in rows or []:
            pg_cur.execute(
                '''
                INSERT INTO portal_shipments
                (shipping_bill_no, invoice_no, port, clearance_status, clearance_date)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (shipping_bill_no) DO NOTHING
                ''',
                (
                    s.get("shipping_bill_no"),
                    s.get("invoice_no"),
                    s.get("port"),
                    s.get("clearance_status"),
                    s.get("clearance_date"),
                ),
            )
        pg.commit()
        pg.close()
    except Exception as e:
        print(f"      [POSTGRES WARNING] Portal seed skipped: {e}")


def seed_users(users):
    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    for u in users or []:
        cur.execute(
            '''
            INSERT OR REPLACE INTO app_users (user_id, password, role, display_name)
            VALUES (?, ?, ?, ?)
            ''',
            (u.get("user_id"), u.get("password"), u.get("role"), u.get("display_name")),
        )
    conn.commit()
    conn.close()
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        for u in users or []:
            pg_cur.execute(
                '''
                INSERT INTO app_users (user_id, password, role, display_name)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE
                SET password = EXCLUDED.password,
                    role = EXCLUDED.role,
                    display_name = EXCLUDED.display_name
                ''',
                (u.get("user_id"), u.get("password"), u.get("role"), u.get("display_name")),
            )
        pg.commit()
        pg.close()
    except Exception as e:
        print(f"      [POSTGRES WARNING] User seed skipped: {e}")


def authenticate_user(user_id, password):
    uid = (user_id or "").strip().lower()
    pwd = (password or "").strip()
    if not uid or not pwd:
        return None

    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        pg_cur.execute(
            "SELECT user_id, role, display_name FROM app_users WHERE lower(user_id) = lower(%s) AND password = %s",
            (uid, pwd),
        )
        row = pg_cur.fetchone()
        pg.close()
        if row:
            return {"user_id": row["user_id"], "role": row["role"], "display_name": row["display_name"]}
    except Exception:
        pass

    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT user_id, role, display_name FROM app_users WHERE lower(user_id) = lower(?) AND password = ?",
        (uid, pwd),
    )
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    return {"user_id": row["user_id"], "role": row["role"], "display_name": row["display_name"]}


def register_user(user_id, password, role, display_name):
    uid = (user_id or "").strip().lower()
    pwd = (password or "").strip()
    role_norm = (role or "domestic").strip().lower()
    dname = (display_name or "").strip()

    if not uid or not pwd or not dname:
        return {"ok": False, "error": "User ID, password, and display name are required."}
    if role_norm not in ("export", "import", "domestic", "super"):
        return {"ok": False, "error": "Invalid role selected."}

    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute("SELECT user_id FROM app_users WHERE lower(user_id) = lower(?)", (uid,))
    exists = cur.fetchone() is not None
    if exists:
        conn.close()
        return {"ok": False, "error": "User ID already exists."}

    cur.execute(
        "INSERT INTO app_users (user_id, password, role, display_name) VALUES (?, ?, ?, ?)",
        (uid, pwd, role_norm, dname),
    )
    conn.commit()
    conn.close()

    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        pg_cur.execute(
            '''
            INSERT INTO app_users (user_id, password, role, display_name)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id) DO NOTHING
            ''',
            (uid, pwd, role_norm, dname),
        )
        pg.commit()
        pg.close()
    except Exception:
        pass

    return {
        "ok": True,
        "user": {"user_id": uid, "role": role_norm, "display_name": dname},
    }


def get_erp_transactions():
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        pg_cur.execute(
            '''
            SELECT invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty
            FROM erp_transactions
            ORDER BY date DESC, invoice_no DESC
            '''
        )
        rows = pg_cur.fetchall()
        pg.close()
        return [dict(r) for r in rows]
    except Exception:
        pass

    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        '''
        SELECT invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty
        FROM erp_transactions
        ORDER BY date DESC, invoice_no DESC
        '''
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def get_portal_shipments():
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        pg_cur.execute(
            '''
            SELECT invoice_no, shipping_bill_no, port, clearance_status, clearance_date
            FROM portal_shipments
            ORDER BY created_at DESC, shipping_bill_no DESC
            '''
        )
        rows = pg_cur.fetchall()
        pg.close()
        return [dict(r) for r in rows]
    except Exception:
        pass

    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        '''
        SELECT invoice_no, shipping_bill_no, port, clearance_status, clearance_date
        FROM portal_shipments
        ORDER BY created_at DESC, shipping_bill_no DESC
        '''
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def insert_order_transaction(client_name, item, qty, rate):
    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    year = datetime.now().year
    inv = f"LOG-INV-{year}-{uuid.uuid4().hex[:6].upper()}"
    cur.execute(
        '''
        INSERT INTO erp_transactions
        (invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            inv,
            client_name,
            f"33{(client_name or 'CUST')[:4].upper()}9999F1Z1",
            item,
            "General Merchandise",
            None,
            qty,
            rate,
            datetime.now().strftime("%Y-%m-%d"),
            "DOMESTIC",
            "Web Storefront",
            "Client Location",
            None,
            None,
        ),
    )
    conn.commit()
    conn.close()

    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        pg_cur.execute(
            '''
            INSERT INTO erp_transactions
            (invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (invoice_no) DO NOTHING
            ''',
            (
                inv,
                client_name,
                f"33{(client_name or 'CUST')[:4].upper()}9999F1Z1",
                item,
                "General Merchandise",
                None,
                qty,
                rate,
                datetime.now().strftime("%Y-%m-%d"),
                "DOMESTIC",
                "Web Storefront",
                "Client Location",
                None,
                None,
            ),
        )
        pg.commit()
        pg.close()
    except Exception as e:
        print(f"      [POSTGRES WARNING] Order not mirrored: {e}")

    return inv


def mirror_unified_to_erp_transactions(records, default_trade_type="DOMESTIC"):
    init_db()

    sqlite_conn = _get_conn()
    sqlite_cur = sqlite_conn.cursor()

    pg = None
    pg_cur = None
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
    except Exception:
        pg = None
        pg_cur = None

    for r in records or []:
        transaction = r.get("transaction", {}) or {}
        shipment = r.get("shipment", {}) or {}
        product = r.get("product", {}) or {}
        customer = r.get("customer", {}) or {}

        invoice_no = r.get("invoice_no")
        if not invoice_no:
            continue

        qty = float(transaction.get("quantity") or 1)
        if qty <= 0:
            qty = 1
        total_value = float(transaction.get("total_value") or 0)
        unit_price = float(transaction.get("unit_price") or (total_value / qty if qty else 0))

        trade_type = str(transaction.get("trade_type") or r.get("trade_type") or default_trade_type).upper()
        if trade_type in ("LOCAL", "LOC", "DOMESTIC", "INLAND"):
            trade_type = "DOMESTIC"
        elif trade_type.startswith("EXP"):
            trade_type = "EXPORT"
        elif trade_type.startswith("IMP"):
            trade_type = "IMPORT"

        row = (
            invoice_no,
            customer.get("name") or "Email Client",
            customer.get("gst_number"),
            product.get("name") or shipment.get("product_description") or "Email Shipment",
            product.get("category") or "Email",
            product.get("hs_code"),
            qty,
            unit_price,
            transaction.get("transaction_date") or datetime.now().strftime("%Y-%m-%d"),
            trade_type,
            shipment.get("origin_location") or "Email Source",
            shipment.get("destination_location") or "Destination Pending",
            shipment.get("port"),
            shipment.get("customs_duty"),
        )

        sqlite_cur.execute(
            '''
            INSERT OR IGNORE INTO erp_transactions
            (invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            row,
        )

        if pg_cur is not None:
            try:
                pg_cur.execute(
                    '''
                    INSERT INTO erp_transactions
                    (invoice_no, client_name, gst_id, item, category, hs_code, qty, rate, date, trade_type, origin, destination, port, customs_duty)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (invoice_no) DO NOTHING
                    ''',
                    row,
                )
            except Exception:
                pass

    sqlite_conn.commit()
    sqlite_conn.close()

    if pg is not None:
        try:
            pg.commit()
            pg.close()
        except Exception:
            pass


def get_dashboard_insights(role="super"):
    tx = get_erp_transactions()
    if role == "export":
        tx = [t for t in tx if (t.get("trade_type") or "").upper() == "EXPORT"]
    elif role == "import":
        tx = [t for t in tx if (t.get("trade_type") or "").upper() == "IMPORT"]
    elif role == "domestic":
        tx = [t for t in tx if (t.get("trade_type") or "").upper() == "DOMESTIC"]

    total_value = sum((float(t.get("qty") or 0) * float(t.get("rate") or 0)) for t in tx)
    total_shipments = len(tx)
    avg_ticket = (total_value / total_shipments) if total_shipments else 0

    by_product = {}
    by_month = {}
    by_route = {}
    for t in tx:
        item = (t.get("item") or "Other").lower()
        product = "Other"
        if "laptop" in item:
            product = "Laptops"
        elif "semiconductor" in item or "chip" in item:
            product = "Semiconductors"
        elif "oil" in item:
            product = "Crude Oil"
        elif "yarn" in item:
            product = "Yarn"
        elif "spice" in item:
            product = "Spices"

        val = float(t.get("qty") or 0) * float(t.get("rate") or 0)
        by_product[product] = by_product.get(product, 0) + val

        date_str = str(t.get("date") or "")
        month = date_str[:7] if len(date_str) >= 7 else "Unknown"
        by_month[month] = by_month.get(month, 0) + val

        route = f"{t.get('origin') or 'N/A'} -> {t.get('destination') or 'N/A'}"
        by_route[route] = by_route.get(route, 0) + val

    ship = get_portal_shipments()
    pending = [
        s
        for s in ship
        if not any(k in (s.get("clearance_status") or "").lower() for k in ["cleared", "departed", "complete", "handed"])
    ]

    port_counts = {}
    for s in ship:
        port = s.get("port") or "Unknown Port"
        port_counts[port] = port_counts.get(port, 0) + 1
    max_port = max(port_counts.values()) if port_counts else 1
    port_activity = [
        {"port": p, "count": c, "pct": int((c / max_port) * 100)}
        for p, c in sorted(port_counts.items(), key=lambda kv: kv[1], reverse=True)[:4]
    ]

    top_routes = sorted(by_route.items(), key=lambda kv: kv[1], reverse=True)[:3]
    monthly_sorted = sorted(by_month.items(), key=lambda kv: kv[0])[-6:]

    return {
        "total_value": total_value,
        "total_shipments": total_shipments,
        "avg_ticket": avg_ticket,
        "pending_shipments": len(pending),
        "distribution": by_product,
        "labels": list(by_product.keys()),
        "values": [round(v / 100000, 2) for v in by_product.values()],
        "monthly": [{"month": m, "value": v} for m, v in monthly_sorted],
        "top_routes": [{"route": r, "value": v} for r, v in top_routes],
        "port_activity": port_activity,
    }


def get_storage_status():
    sqlite_ready = False
    sqlite_rows = 0
    try:
        init_db()
        conn = _get_conn()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) AS c FROM unified_trade")
        sqlite_rows = int(cur.fetchone()["c"])
        conn.close()
        sqlite_ready = True
    except Exception:
        sqlite_ready = False

    pg_ready = False
    pg_rows = 0
    pg_error = ""
    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        pg_cur.execute("SELECT COUNT(*) FROM unified_trade")
        pg_rows = int(pg_cur.fetchone()[0])
        pg.close()
        pg_ready = True
    except Exception as e:
        pg_ready = False
        pg_error = str(e)

    vector = get_vector_db_stats()
    return {
        "sqlite": {"ready": sqlite_ready, "rows": sqlite_rows},
        "postgres": {"ready": pg_ready, "rows": pg_rows, "error": pg_error},
        "chroma": vector,
    }


def record_ingestion_run(connector_key, status, records=0, message=""):
    init_db()
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        '''
        INSERT INTO ingestion_runs (connector_key, status, records, message)
        VALUES (?, ?, ?, ?)
        ''',
        (connector_key, status, int(records or 0), message or ""),
    )
    conn.commit()
    conn.close()

    try:
        pg = _get_pg_conn()
        pg_cur = pg.cursor()
        pg_cur.execute(
            '''
            INSERT INTO ingestion_runs (connector_key, status, records, message)
            VALUES (%s, %s, %s, %s)
            ''',
            (connector_key, status, int(records or 0), message or ""),
        )
        pg.commit()
        pg.close()
    except Exception:
        pass


def get_ingestion_connector_stats():
    init_db()

    # Latest run per connector from local SQL store.
    conn = _get_conn()
    cur = conn.cursor()
    cur.execute(
        '''
        SELECT ir.connector_key, ir.status, ir.records, ir.message, ir.run_at
        FROM ingestion_runs ir
        INNER JOIN (
            SELECT connector_key, MAX(run_at) AS max_run
            FROM ingestion_runs
            GROUP BY connector_key
        ) latest
            ON latest.connector_key = ir.connector_key
           AND latest.max_run = ir.run_at
        '''
    )
    latest_rows = [dict(r) for r in cur.fetchall()]

    cur.execute(
        '''
        SELECT UPPER(COALESCE(source, 'UNKNOWN')) AS source, COUNT(*) AS count
        FROM unified_trade
        GROUP BY UPPER(COALESCE(source, 'UNKNOWN'))
        '''
    )
    source_counts = {str(r["source"]): int(r["count"]) for r in cur.fetchall()}
    conn.close()

    latest_map = {r["connector_key"]: r for r in latest_rows}

    def pick_count(key):
        if key == "erp":
            return len(get_erp_transactions())
        if key == "portal":
            return len(get_portal_shipments())
        if key == "email":
            return source_counts.get("EMAIL", 0)
        if key == "pdf":
            return source_counts.get("PDF", 0)
        if key == "excel":
            return source_counts.get("EXCEL", 0)
        return 0

    connectors = [
        {"key": "erp", "name": "ERP Database Sync (SAP)", "type": "REST API", "default_status": "Connected"},
        {"key": "email", "name": "Corporate IMAP Mailbox", "type": "EMAIL", "default_status": "Connected"},
        {"key": "portal", "name": "Regional Portals Tracker", "type": "REST API", "default_status": "Connected"},
        {"key": "pdf", "name": "Customs PDF Directory Watch", "type": "FILE SYSTEM", "default_status": "Connected"},
        {"key": "excel", "name": "Monthly Master Data Sheets", "type": "SPREADSHEET", "default_status": "Scheduled"},
    ]

    result = []
    for c in connectors:
        latest = latest_map.get(c["key"], {})
        result.append(
            {
                "key": c["key"],
                "name": c["name"],
                "type": c["type"],
                "status": latest.get("status") or c["default_status"],
                "last_sync": latest.get("run_at") or "",
                "volume": pick_count(c["key"]),
                "message": latest.get("message") or "",
            }
        )
    return result


def build_operational_vector_records():
    transactions = get_erp_transactions()
    shipments = get_portal_shipments()

    shipments_by_invoice = {}
    for shipment in shipments:
        invoice_no = shipment.get("invoice_no")
        if not invoice_no:
            continue
        shipments_by_invoice.setdefault(invoice_no, []).append(shipment)

    records = []
    seen_invoices = set()

    for transaction in transactions:
        invoice_no = transaction.get("invoice_no")
        if not invoice_no:
            continue

        seen_invoices.add(invoice_no)
        quantity = float(transaction.get("qty") or 0)
        rate = float(transaction.get("rate") or 0)
        total_value = quantity * rate
        shipment = (shipments_by_invoice.get(invoice_no) or [None])[0] or {}

        records.append(
            {
                "invoice_no": invoice_no,
                "date": transaction.get("date"),
                "source": "ERP",
                "trade_type": transaction.get("trade_type") or "UNKNOWN",
                "customer": {
                    "name": transaction.get("client_name") or "N/A",
                    "gst_number": transaction.get("gst_id"),
                },
                "product": {
                    "name": transaction.get("item") or "N/A",
                    "category": transaction.get("category") or "Other",
                    "hs_code": transaction.get("hs_code"),
                },
                "shipment": {
                    "product_description": transaction.get("item") or "N/A",
                    "quantity": quantity,
                    "origin_location": transaction.get("origin") or "N/A",
                    "destination_location": transaction.get("destination") or "N/A",
                    "route": f"{transaction.get('origin') or 'N/A'} -> {transaction.get('destination') or 'N/A'}",
                    "port": shipment.get("port") or transaction.get("port") or "N/A",
                    "clearance_status": shipment.get("clearance_status") or "N/A",
                    "customs_duty": transaction.get("customs_duty"),
                },
                "transaction": {
                    "quantity": quantity,
                    "unit_price": rate,
                    "total_value": total_value,
                    "transaction_date": transaction.get("date"),
                    "trade_type": transaction.get("trade_type") or "UNKNOWN",
                },
                "financials": {
                    "rate": rate,
                    "total_value": total_value,
                },
            }
        )

    for shipment in shipments:
        invoice_no = shipment.get("invoice_no") or shipment.get("shipping_bill_no")
        if not invoice_no or invoice_no in seen_invoices:
            continue

        records.append(
            {
                "invoice_no": invoice_no,
                "date": shipment.get("clearance_date") or datetime.now().strftime("%Y-%m-%d"),
                "source": "PORTAL",
                "trade_type": "UNKNOWN",
                "customer": {"name": "N/A"},
                "product": {"name": "N/A", "category": "Unknown"},
                "shipment": {
                    "product_description": "Portal Shipment",
                    "quantity": 0,
                    "origin_location": "N/A",
                    "destination_location": shipment.get("port") or "N/A",
                    "route": shipment.get("port") or "N/A",
                    "port": shipment.get("port") or "N/A",
                    "clearance_status": shipment.get("clearance_status") or "N/A",
                },
                "transaction": {
                    "quantity": 0,
                    "unit_price": 0,
                    "total_value": 0,
                    "transaction_date": shipment.get("clearance_date") or datetime.now().strftime("%Y-%m-%d"),
                    "trade_type": "UNKNOWN",
                },
                "financials": {"rate": 0, "total_value": 0},
            }
        )

    return records


def sync_vector_from_operational_data(reset=True):
    records = build_operational_vector_records()
    if not records:
        return 0
    save_to_vector_db(records, reset=reset)
    return len(records)

# --- VECTOR DB LAYER (CHROMA DB FOR RAG) ---
def save_to_vector_db(records, reset=True):
    try:
        # Initialize Chromadb Client
        persist_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
        client = chromadb.PersistentClient(path=persist_dir)
        
        # Multilingual embedding model improves retrieval for regional Indian language queries.
        sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="paraphrase-multilingual-MiniLM-L12-v2")
        
        if reset:
            try:
                client.delete_collection("trade_knowledge_base")
            except Exception:
                pass

        collection = client.get_or_create_collection(
            name="trade_knowledge_base",
            embedding_function=sentence_transformer_ef
        )
        
        # Prepare data for Vector indexing
        documents = []
        metadatas = []
        ids = []
        
        for i, r in enumerate(records):
            customer = r.get("customer", {}) or {}
            product = r.get("product", {}) or {}
            shipment = r.get("shipment", {}) or {}
            transaction = r.get("transaction", {}) or {}
            financials = r.get("financials", {}) or {}

            product_name = product.get("name") or shipment.get("product_description") or "N/A"
            origin = shipment.get("origin_location") or shipment.get("route") or "N/A"
            destination = shipment.get("destination_location") or "N/A"
            total_value = transaction.get("total_value") or financials.get("total_value") or 0
            trade_type = transaction.get("trade_type") or r.get("trade_type") or "UNKNOWN"
            clearance_status = shipment.get("clearance_status") or "N/A"
            port = shipment.get("port") or "N/A"

            # Create a textual representation of the transaction for semantic search
            text_desc = f"Transaction {r.get('invoice_no')} by {customer.get('name', 'N/A')}. " \
                        f"Item: {product_name}. " \
                        f"Trade type: {trade_type}. " \
                        f"Route: {origin} to {destination}. " \
                        f"Port: {port}. " \
                        f"Clearance: {clearance_status}. " \
                        f"Value: INR {total_value}. " \
                        f"Source: {r.get('source')}."
            
            documents.append(text_desc)
            metadatas.append({
                "invoice_no": str(r.get("invoice_no")),
                "source": str(r.get("source")),
                "type": str(trade_type)
            })
            ids.append(f"id_{i}_{r.get('invoice_no')}_{r.get('source')}_{uuid.uuid4().hex[:8]}")

        # Batch insert to Vector DB
        collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        print(f"      [VECTOR DB] Indexed {len(records)} records for semantic RAG search.")
    except Exception as e:
        print(f"      [VECTOR DB WARNING] Failed to index: {e}")


def get_vector_db_stats():
    persist_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
    client = chromadb.PersistentClient(path=persist_dir)
    sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="paraphrase-multilingual-MiniLM-L12-v2")
    try:
        collection = client.get_collection(name="trade_knowledge_base", embedding_function=sentence_transformer_ef)
        return {
            "collection": "trade_knowledge_base",
            "count": int(collection.count()),
            "status": "ready",
        }
    except Exception as e:
        return {
            "collection": "trade_knowledge_base",
            "count": 0,
            "status": "missing",
            "error": str(e),
        }


def ensure_vector_sync_with_operational_data():
    """
    Ensure Chroma reflects operational ERP/portal records.
    If vector count is lower than operational count, rebuild vector index.
    """
    operational_records = build_operational_vector_records()
    operational_count = len(operational_records)
    stats = get_vector_db_stats()
    vector_count = int(stats.get("count") or 0)

    rebuilt = False
    indexed_records = vector_count
    if operational_count > 0 and vector_count < operational_count:
        indexed_records = sync_vector_from_operational_data(reset=True)
        rebuilt = True
        stats = get_vector_db_stats()

    return {
        **stats,
        "operational_count": operational_count,
        "in_sync": int(stats.get("count") or 0) >= operational_count,
        "rebuilt": rebuilt,
        "indexed_records": indexed_records,
    }
