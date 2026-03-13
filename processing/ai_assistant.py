import chromadb
from chromadb.utils import embedding_functions
import httpx
import os
from typing import List

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
        return "Respond primarily in Tamil. Keep terms like invoice numbers and trade types as-is."
    if mode == "hi":
        return "Respond primarily in Hindi. Keep terms like invoice numbers and trade types as-is."
    return "Respond in clear Indian English."


def _generate_llm_response(user_query: str, docs: List[str], mode: str) -> str:
    provider = os.getenv("LLM_PROVIDER", "openai-compatible").strip().lower()
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").strip().rstrip("/")

    if provider == "ollama":
        model = os.getenv("LLM_MODEL", "deepseek-r1:8b").strip()
        base_url = os.getenv("LLM_BASE_URL", "http://127.0.0.1:11434").strip().rstrip("/")

    context_block = "\n\n".join(docs) if docs else "No context retrieved from vector DB."
    system_prompt = (
        "You are a Trade Intelligence assistant for logistics and compliance data. "
        "Answer strictly using the retrieved context. If context is insufficient, state that clearly and ask a focused follow-up. "
        "Use a concise, natural, professional human tone. "
        f"{_llm_language_instruction(mode)}"
    )
    user_prompt = (
        "User query:\n"
        f"{user_query}\n\n"
        "Retrieved context from Chroma DB:\n"
        f"{context_block}\n\n"
        "Return a direct answer with concrete references from context when possible."
    )

    with httpx.Client(timeout=60.0) as client_http:
        if provider == "ollama":
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
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
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
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

def get_ai_response(user_query, lang="en-IN"):
    try:
        collection = client.get_collection(name="trade_knowledge_base", embedding_function=sentence_transformer_ef)
        mode = _detect_lang_mode(user_query or "", lang or "en-IN")
        
        # RAG: Retrieve top 4 relevant records
        results = collection.query(
            query_texts=[user_query],
            n_results=4
        )
        
        docs = results.get("documents", [[]])[0]
        metas = results.get("metadatas", [[]])[0]
        response = _generate_llm_response(user_query or "", docs, mode)
            
        return {
            "answer": response,
            "sources": metas,
            "context_snippets": docs
        }
    except Exception as e:
        return {"answer": f"I'm sorry, I encountered an error accessing the knowledge base: {str(e)}", "sources": []}
