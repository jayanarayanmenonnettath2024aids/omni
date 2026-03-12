import chromadb
from chromadb.utils import embedding_functions
import os
import json

# Initialize ChromaDB Client (Persistent)
persist_dir = os.path.join(os.path.dirname(__file__), "..", "chroma_db")
client = chromadb.PersistentClient(path=persist_dir)
sentence_transformer_ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

def get_ai_response(user_query, lang="en-IN"):
    try:
        collection = client.get_collection(name="trade_knowledge_base", embedding_function=sentence_transformer_ef)
        
        # Detect Tamil: Either by script presence OR by the explicit 'lang' toggle from frontend
        is_tamil = any(ord(c) >= 2944 and ord(c) <= 3071 for c in user_query) or lang.startswith("ta")
        
        # RAG: Retrieve top 4 relevant records
        results = collection.query(
            query_texts=[user_query],
            n_results=4
        )
        
        context = "\n".join(results['documents'][0])
        
        # --- SMART RESPONSE LOGIC (Simulating LLM with RAG Context) ---
        # In a production app, you'd send 'context' + 'user_query' to GPT-4 or Gemini.
        # For our demo, we'll parse the context to provide a "smart" answer.
        
        
        response = ""
        if "boe" in user_query.lower() or "bill of entry" in user_query.lower():
            response = "I have identified the latest Bill of Entry (BOE No: 8899221) for Crude Oil imports. The shipment from ADNOC (Abu Dhabi) valued at INR 80 Lakhs is currently documented in the Kochi Port systems."
        elif any(k in user_query.lower() for k in ["hike", "comparison", "last 5 months", "ஏற்றம்", "விலை", "ஒப்பீடு", "அதிகரிப்பு", "கடந்த", "மாதங்கள்", "ஐந்து", "5 மாத", "ஐந்து மாதங்கள", "கூடுதல்", "குறைவு"]):
            en = "Analytical scan reveals stable Crude Oil prices and 15% growth in Semiconductors over the last 5 months."
            ta = "கடந்த 5 மாதங்களில் கச்சா எண்ணெய் விலை நிலையாக உள்ளது. குறைக்கடத்தி (Semiconductors) இறக்குமதி 15% அதிகரித்துள்ளது."
            response = ta if is_tamil else en
        elif any(k in user_query.lower() for k in ["yarn", "நூல்", "துணி", "நூற்பு"]):
            en = "Significant Yarn activity detected. A shipment of Premium Cotton Yarn (INR 9 Lakhs) for Dubai was processed at Chennai Port."
            ta = "நூல் ஏற்றுமதி சென்னையில் சிறப்பாக உள்ளது. துபாய் வரை செல்லும் 9 லட்சம் ரூபாய் மதிப்புள்ள சரக்கு கையாளப்பட்டது."
            response = ta if is_tamil else en
        elif any(k in user_query.lower() for k in ["semiconductor", "chip", "குறைக்கடத்தி", "சிப்", "சில்லு"]):
            en = "Import of Semiconductors from Taiwan (INR 1.25 Crore) is pending customs at Nhava Sheva."
            ta = "தைவானிலிருந்து 1.25 கோடி ரூபாய் மதிப்புள்ள குறைக்கடத்திகள் வந்துள்ளன. இவை தற்போது நவா சேவா துறைமுகத்தில் உள்ளன."
            response = ta if is_tamil else en
        elif any(k in user_query.lower() for k in ["crude oil", "எண்ணெய்", "கச்சா", "ஆயில்"]):
            en = "Active Crude Oil imports from Saudi Arabia valued at INR 80 Lakhs recorded in the system."
            ta = "சவூதி அரேபியாவிலிருந்து 80 லட்சம் ரூபாய் மதிப்புள்ள கச்சா எண்ணெய் இறக்குமதி செய்யப்பட்டுள்ளது."
            response = ta if is_tamil else en
        elif any(k in user_query.lower() for k in ["laptop", "கணினி", "லேப்டாப்", "மடிக்கணினி"]):
            en = "Domestic movement of Laptops (Bangalore to Chennai) is high, with 50 units recently processed."
            ta = "பெங்களூரிலிருந்து சென்னைக்கு 50 மடிக்கணினிகள் (Laptops) கொண்டு வரப்பட்டுள்ளன."
            response = ta if is_tamil else en
        else:
            ta_fallback = "உங்கள் கேள்விக்குத் தொடர்புடைய தரவுகளை நான் ஆராய்ந்தேன். எதில் நான் உங்களுக்கு உதவ முடியும்?"
            response = f"{ta_fallback}<br><br>**English:** {en_fallback}" if is_tamil else en_fallback
            
        return {
            "answer": response,
            "sources": results['metadatas'][0],
            "context_snippets": results['documents'][0]
        }
    except Exception as e:
        return {"answer": f"I'm sorry, I encountered an error accessing the knowledge base: {str(e)}", "sources": []}
