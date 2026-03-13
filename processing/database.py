import os
import json
import uuid
import psycopg2
from psycopg2.extras import execute_values
import chromadb
from chromadb.utils import embedding_functions

# --- CONFIGURATION (UPDATE WITH YOUR POSTGRES CREDENTIALS FOR DEMO) ---
DB_CONFIG = {
    "dbname": "trade_intelligence",
    "user": "postgres",
    "password": "yourpassword",
    "host": "localhost",
    "port": "5432"
}

# --- POSTGRES LAYER (STRUCTURAL DATA) ---
def init_postgres():
    try:
        # Connect to default postgres to create our specific database if it doesn't exist
        conn = psycopg2.connect(
            dbname='postgres',
            user=DB_CONFIG['user'],
            password=DB_CONFIG['password'],
            host=DB_CONFIG['host'],
            port=DB_CONFIG['port']
        )
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{DB_CONFIG['dbname']}'")
        exists = cur.fetchone()
        if not exists:
            cur.execute(f"CREATE DATABASE {DB_CONFIG['dbname']}")
        cur.close()
        conn.close()

        # Connect to our database and create tables
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS unified_trade (
                id SERIAL PRIMARY KEY,
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
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()
        cur.close()
        conn.close()
        print("      [POSTGRES] Structural DB Initialized.")
    except Exception as e:
        print(f"      [POSTGRES WARNING] Could not connect/init: {e}")
        print("      Running in MOCK mode for structural storage.")

def save_to_postgres(records, reset=True):
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        if reset:
            cur.execute("DELETE FROM unified_trade") # Reset for fresh ingestion
        
        data_to_insert = []
        for r in records:
            transaction = r.get("transaction", {}) or {}
            financials = r.get("financials", {}) or {}
            shipment = r.get("shipment", {}) or {}
            data_to_insert.append((
                r.get("invoice_no"),
                r.get("customer", {}).get("name"),
                shipment.get("product_description") or (r.get("product", {}) or {}).get("name"),
                shipment.get("quantity", transaction.get("quantity", 0)),
                financials.get("rate", transaction.get("unit_price", 0)),
                financials.get("total_value", transaction.get("total_value", 0)),
                r.get("date") or transaction.get("transaction_date"),
                r.get("trade_type", transaction.get("trade_type", "DOMESTIC")),
                shipment.get("origin_location"),
                shipment.get("destination_location"),
                r.get("source")
            ))
        
        execute_values(cur, '''
            INSERT INTO unified_trade 
            (invoice_no, client_name, item, qty, rate, total_value, date, trade_type, origin, destination, source)
            VALUES %s
        ''', data_to_insert)
        
        conn.commit()
        cur.close()
        conn.close()
        print(f"      [POSTGRES] Successfully persisted {len(records)} records.")
    except Exception as e:
        print(f"      [POSTGRES WARNING] Data not saved to real instance: {e}")

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

def init_db():
    init_postgres()

def save_to_data_lake(records, reset=True):
    save_to_postgres(records, reset=reset)
    save_to_vector_db(records, reset=reset)


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
