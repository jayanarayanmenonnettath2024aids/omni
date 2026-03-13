import chromadb
from chromadb.utils import embedding_functions
import httpx
import os
from typing import List
import re
from datetime import datetime

# Initialize ChromaDB Client (Persistent)
persist_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
client = chromadb.PersistentClient(path=persist_dir)
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="paraphrase-multilingual-MiniLM-L12-v2")


def _detect_lang_mode(user_query: str, lang: str) -> str:
    lang_code = (lang or "en-IN").lower()
    if lang_code.startswith("ta"):
        return "ta"
    if lang_code.startswith("hi"):
        return "hi"

    for ch in user_query or "":
        code = ord(ch)
        # Tamil block
        if 2944 <= code <= 3071:
            return "ta"
        # Devanagari block (Hindi)
        if 2304 <= code <= 2431:
            return "hi"
    return "en"


def _llm_language_instruction(mode: str) -> str:
    if mode == "ta":
        return "Respond ONLY in Tamil. Do not switch to English or Hindi. Keep terms like invoice numbers and trade types as-is."
    if mode == "hi":
        return "Respond ONLY in Hindi. Do not switch to English or Tamil. Keep terms like invoice numbers and trade types as-is."
    return "Respond ONLY in clear Indian English."


def _expand_query_variants(user_query: str) -> List[str]:
    q = (user_query or "").strip()
    if not q:
        return [""]

    variants = [q]
    q_lower = q.lower()

    # Expand very short prompts so vector retrieval has enough semantic signal.
    if len(q.split()) <= 3:
        variants.append(f"{q} trade volume shipments ports customs clearance status")

    if "today" in q_lower:
        variants.append(q_lower.replace("today", "this month latest records"))
    if "this month" in q_lower or "month" in q_lower:
        variants.append(f"{q} current month trade summary by import export and pending clearances")

    if any(k in q_lower for k in ["nepal", "dubai", "singapore", "chennai", "kochi", "mumbai"]):
        variants.append(f"{q} route origin destination port shipment and invoice details")

    if any(k in q_lower for k in ["shipment", "shipments"]) and any(k in q_lower for k in ["left", "pending", "how many", "remaining"]):
        variants.append(
            f"{q} clearance status pending awaiting in transit document verification gate-in customs count"
        )

    # Tamil/Hindi/vernacular hints for trade value and month-based asks.
    if any(k in q_lower for k in ["trade value", "value this month", "month trade", "this month value"]):
        variants.append(f"{q} total trade value current month invoice value INR by date")
    if any(k in q for k in ["இந்த", "மாசம்", "டிரேட்", "வேல்யூ", "வேலி", "மதிப்பு"]):
        variants.append("இந்த மாசம் trade value total INR date invoice")
        variants.append("current month trade value total INR by transactions")
    if any(k in q for k in ["इस", "महीने", "ट्रेड", "वैल्यू", "मूल्य"]):
        variants.append("इस महीने trade value total INR by date")

    # Deduplicate while preserving order
    deduped = []
    seen = set()
    for item in variants:
        key = item.strip().lower()
        if key and key not in seen:
            deduped.append(item)
            seen.add(key)
    return deduped or [q]


def _extract_trade_rows(docs: List[str]) -> List[dict]:
    rows = []
    for d in docs or []:
        text = str(d or "")
        if "value:" not in text.lower() and "inr" not in text.lower():
            continue

        date_match = re.search(r"date:\s*(\d{4}-\d{2}-\d{2})", text, re.IGNORECASE)
        value_match = re.search(r"value:\s*inr\s*([0-9,]+(?:\.\d+)?)", text, re.IGNORECASE)
        inv_match = re.search(r"transaction\s+(\S+)", text, re.IGNORECASE)

        if not value_match:
            continue

        try:
            amount = float(value_match.group(1).replace(",", ""))
        except Exception:
            continue

        rows.append({
            "invoice": inv_match.group(1) if inv_match else "?",
            "date": date_match.group(1) if date_match else "",
            "value": amount,
        })
    return rows


def _derive_trade_value_answer(user_query: str, docs: List[str], mode: str) -> str:
    q = (user_query or "").lower().strip()

    trade_value_terms = ["trade value", "value", "மதிப்பு", "வேல்யூ", "வேலி", "वैल्यू", "मूल्य"]
    month_terms = ["this month", "month", "இந்த மாசம்", "இந்த மாதம்", "इस महीने", "महीने"]

    # Robust intent detection for EN/TA/HI with transliterated spellings.
    ta_trade_intent = any(t in q for t in ["டிரே", "டிரேட்", "வேல", "வேல்ய", "மதிப்பு", "விலை"])
    ta_month_intent = any(t in q for t in ["மாச", "மாத"])
    hi_trade_intent = any(t in q for t in ["ट्रेड", "वैल", "मूल्य", "कीमत"])
    hi_month_intent = any(t in q for t in ["मही", "माह"])
    en_trade_intent = any(t in q for t in ["trade value", "trade", "value"])

    if not (en_trade_intent or ta_trade_intent or hi_trade_intent or any(t in q for t in trade_value_terms)):
        return ""

    rows = _extract_trade_rows(docs)
    if not rows:
        return ""

    today = datetime.now()
    month_rows = []
    for r in rows:
        ds = r.get("date") or ""
        try:
            dt = datetime.strptime(ds, "%Y-%m-%d") if ds else None
        except Exception:
            dt = None
        if dt and dt.year == today.year and dt.month == today.month:
            month_rows.append(r)

    wants_month = any(t in q for t in month_terms) or ta_month_intent or hi_month_intent
    target_rows = month_rows if wants_month and month_rows else rows
    total_value = sum(r["value"] for r in target_rows)
    top = sorted(target_rows, key=lambda x: x["value"], reverse=True)[:3]

    if mode == "ta":
        lines = [f"இந்த மாத டிரேட் மொத்த மதிப்பு: INR {total_value:,.2f}."]
        if top:
            lines.append("முக்கிய டிரான்ஸாக்ஷன்கள்:")
            for r in top:
                lines.append(f"- {r['invoice']} ({r.get('date') or 'N/A'}): INR {r['value']:,.2f}")
        return "\n".join(lines)
    if mode == "hi":
        lines = [f"इस महीने का कुल ट्रेड वैल्यू: INR {total_value:,.2f}."]
        if top:
            lines.append("मुख्य ट्रांजैक्शन:")
            for r in top:
                lines.append(f"- {r['invoice']} ({r.get('date') or 'N/A'}): INR {r['value']:,.2f}")
        return "\n".join(lines)

    lines = [f"Total trade value{' for this month' if month_rows else ''}: INR {total_value:,.2f}."]
    if top:
        lines.append("Top transactions:")
        for r in top:
            lines.append(f"- {r['invoice']} ({r.get('date') or 'N/A'}): INR {r['value']:,.2f}")
    return "\n".join(lines)


def _derive_shipment_left_answer(user_query: str, docs: List[str], mode: str, history: List[dict] = None) -> str:
    q = (user_query or "").lower().strip()

    # Detect follow-up port-wise requests (e.g., "yes pls", "yes", "show it")
    last_ai = ""
    if history:
        for h in reversed(history):
            if h.get("role") in ("ai", "assistant"):
                last_ai = (h.get("content") or "").lower()
                break
    port_wise_followup = (
        ("port-wise" in last_ai or "port wise" in last_ai or "port-wise pending" in last_ai
         or "port-wise breakdown" in last_ai)
        and any(q.startswith(w) for w in ["yes", "ok", "sure", "please", "show", "give", "yeah", "go", "pls"])
    )

    is_shipment_query = any(k in q for k in ["shipment", "ship"]) and any(
        k in q for k in ["left", "pending", "how many", "remaining", "status", "count"]
    )

    if not (is_shipment_query or port_wise_followup):
        return ""

    if not docs:
        return ""

    pending_tokens = ["awaiting", "pending", "in transit", "verification", "gate-in", "inspection", "not cleared"]
    cleared_tokens = ["cleared", "departed", "customs inspection complete", "handed to shipping line"]

    total = 0
    pending = 0
    cleared = 0
    port_pending: dict = {}  # port -> list of "INVOICE (status)"

    for d in docs:
        s = (d or "").lower()
        if "clearance" not in s:
            continue
        total += 1
        is_p = any(tok in s for tok in pending_tokens)
        is_c = any(tok in s for tok in cleared_tokens)

        # Extract port name
        port = "Unknown Port"
        port_match = re.search(r'port:\s*([^.]+)\.', d, re.IGNORECASE)
        if port_match:
            port = port_match.group(1).strip()

        # Extract clearance status
        clr_status = "Unknown"
        clr_match = re.search(r'clearance:\s*([^.]+)\.', d, re.IGNORECASE)
        if clr_match:
            clr_status = clr_match.group(1).strip()

        # Extract invoice number
        inv_match = re.search(r'transaction\s+(\S+)', d, re.IGNORECASE)
        inv = inv_match.group(1) if inv_match else "?"

        if is_c and not is_p:
            cleared += 1
        else:
            pending += 1
            if port not in port_pending:
                port_pending[port] = []
            port_pending[port].append(f"{inv} — {clr_status}")

    if total == 0:
        return ""

    if port_wise_followup:
        if not port_pending:
            if mode == "ta":
                return "Pending shipments-க்கு port-wise data கிடைக்கவில்லை."
            if mode == "hi":
                return "Pending shipments की port-wise जानकारी उपलब्ध नहीं है।"
            return "No pending shipments found in retrieved context."
        lines = ["**Port-wise Pending Shipments:**\n"]
        for port_name, items in port_pending.items():
            lines.append(f"**{port_name}** — {len(items)} pending:")
            for item in items:
                lines.append(f"  - {item}")
        return "\n".join(lines)

    if mode == "ta":
        return (f"Retrieved shipment context-இல் மொத்தம் {total} shipment records கிடைத்தது. "
                f"அதில் pending/left சுமார் {pending}, cleared {cleared}. "
                "தேவையெனில் port-wise breakdown கொடுக்கலாம்.")
    if mode == "hi":
        return (f"Retrieved shipment context में कुल {total} shipment records मिले। "
                f"इनमें pending/left लगभग {pending} और cleared {cleared} हैं। "
                "चाहें तो मैं port-wise breakdown भी दे सकता हूँ।")
    return (
        f"From the retrieved shipment context, total shipment records: {total}. "
        f"Pending/left shipments: {pending}. Cleared shipments: {cleared}. "
        "I can also provide a port-wise pending list if you want."
    )


def _generate_llm_response(user_query: str, docs: List[str], mode: str, history: List[dict] = None) -> str:
    provider = os.getenv("LLM_PROVIDER", "openai-compatible").strip().lower()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")

    if provider == "ollama":
        model = os.getenv("LLM_MODEL", "deepseek-r1:8b").strip()
        base_url = os.getenv("LLM_BASE_URL", "http://127.0.0.1:11434").strip().rstrip("/")

    context_block = "\n\n".join(docs) if docs else "No context retrieved from vector DB."
    today_str = datetime.now().strftime("%Y-%m-%d")
    system_prompt = (
        "You are a Trade Intelligence assistant for logistics and compliance data. "
        "Answer strictly using the retrieved context. "
        "Always provide a best-effort direct answer first using whatever context is available. "
        "If data is partial, clearly mark assumptions and then ask one focused follow-up question. "
        "If an exact city/country/date is not found, provide the nearest available snapshot: "
        "latest 2-4 relevant records with date, route/port, and trade value, then mention the missing field. "
        "Use a concise, natural, professional human tone. "
        f"{_llm_language_instruction(mode)}"
    )
    user_prompt = (
        "User query:\n"
        f"{user_query}\n\n"
        f"Current date: {today_str}\n"
        "Interpret relative time words like 'today' and 'this month' against the current date.\n\n"
        "Retrieved context from Chroma DB:\n"
        f"{context_block}\n\n"
        "Return a direct answer with concrete references from context when possible."
    )

    # Build messages list with conversation history for context
    api_messages = [{"role": "system", "content": system_prompt}]
    for h in (history or []):
        h_role = h.get("role", "user")
        h_content = (h.get("content") or "").strip()
        if not h_content:
            continue
        api_role = "user" if h_role == "user" else "assistant"
        api_messages.append({"role": api_role, "content": h_content})
    api_messages.append({"role": "user", "content": user_prompt})

    with httpx.Client(timeout=60.0) as client_http:
        if provider == "ollama":
            payload = {
                "model": model,
                "messages": api_messages,
                "stream": False,
                "options": {"temperature": 0.3},
            }
            resp = client_http.post(f"{base_url}/api/chat", json=payload, headers={"Content-Type": "application/json"})
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama API error ({resp.status_code}): {resp.text[:300]}")
            data = resp.json()
            message = data.get("message") or {}
            content = (message.get("content") or "").strip()
            if not content:
                raise RuntimeError("Ollama returned empty content.")
            return content

        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        elif "openai.com" in base_url:
            raise RuntimeError("LLM_API_KEY is not configured. Add it in .env to enable RAG answers.")

        payload = {
            "model": model,
            "messages": api_messages,
            "temperature": 0.3,
        }

        resp = client_http.post(f"{base_url}/chat/completions", json=payload, headers=headers)
        if resp.status_code != 200:
            raise RuntimeError(f"LLM API error ({resp.status_code}): {resp.text[:300]}")

        data = resp.json()
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("LLM API returned no choices.")

        message = choices[0].get("message") or {}
        content = (message.get("content") or "").strip()
        if not content:
            raise RuntimeError("LLM API returned empty content.")
        return content

def get_ai_response(user_query, lang="en-IN", history=None):
    try:
        collection = client.get_collection(name="trade_knowledge_base", embedding_function=sentence_transformer_ef)
        mode = _detect_lang_mode(user_query or "", lang or "en-IN")

        query_variants = _expand_query_variants(user_query or "")
        results = collection.query(query_texts=query_variants, n_results=4)

        raw_docs = results.get("documents", [])
        raw_metas = results.get("metadatas", [])

        docs = []
        metas = []
        seen_docs = set()
        for i, docs_for_variant in enumerate(raw_docs):
            metas_for_variant = raw_metas[i] if i < len(raw_metas) else []
            for j, doc in enumerate(docs_for_variant or []):
                norm = re.sub(r"\s+", " ", str(doc or "")).strip().lower()
                if not norm or norm in seen_docs:
                    continue
                seen_docs.add(norm)
                docs.append(doc)
                metas.append(metas_for_variant[j] if j < len(metas_for_variant) else {})
                if len(docs) >= 8:
                    break
            if len(docs) >= 8:
                break

        q_norm = (user_query or "").lower()
        strict_trade_value_intent = (
            any(k in q_norm for k in ["trade value", "this month value", "month trade", "value this month", "மதிப்பு", "வேல", "वैल्यू", "मूल्य"])
            and any(k in q_norm for k in ["month", "this month", "மாச", "மாத", "मही", "माह"])
        )

        derived_answer = _derive_shipment_left_answer(user_query or "", docs, mode, history or [])
        if not derived_answer:
            derived_answer = _derive_trade_value_answer(user_query or "", docs, mode)

        if strict_trade_value_intent and derived_answer:
            response = derived_answer
        else:
            response = derived_answer or _generate_llm_response(user_query or "", docs, mode, history or [])
            
        return {
            "answer": response,
            "sources": metas,
            "context_snippets": docs
        }
    except Exception as e:
        msg = str(e)
        if mode == "ta":
            return {"answer": f"மன்னிக்கவும், அறிவகத்தை அணுகும் போது பிழை ஏற்பட்டது: {msg}", "sources": []}
        if mode == "hi":
            return {"answer": f"क्षमा करें, नॉलेज बेस एक्सेस करते समय त्रुटि हुई: {msg}", "sources": []}
        return {"answer": f"I encountered an error while accessing the knowledge base: {msg}", "sources": []}
