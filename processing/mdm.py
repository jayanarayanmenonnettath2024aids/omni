from thefuzz import process, fuzz

MASTER_CUSTOMERS = [
    "TechCorp Industries",
    "Oceanic Importers",
    "Metro Retailers",
    "Nordic Solutions",
    "Reliance Retail",
    "TANCAM Innovations Ltd",
    "ABC Textiles Pvt Ltd",
    "Global Knit Exports",
    "Omega Trading Co."
]

MASTER_LOCATIONS = [
    "Chennai",
    "Coimbatore",
    "Singapore",
    "Dubai",
    "Oslo",
    "Bangalore",
    "Surat",
    "Tiruppur",
    "Mumbai"
]

MASTER_PRODUCTS = [
    "Laptops",
    "Crude Oil",
    "Semiconductors",
    "Yarn",
    "Spices"
]

def standardize_entity(raw_name, master_list, entity_type):
    if not isinstance(raw_name, str) or not raw_name.strip():
        return raw_name, 0
        
    # Try fuzzy matching against our "golden" records using token_sort_ratio
    match, score = process.extractOne(raw_name, master_list, scorer=fuzz.token_sort_ratio)
    
    # If the match score is high enough (e.g. >= 80) but not an exact string match, we resolve it
    if score >= 80:
        if raw_name.strip().lower() != match.lower():
            print(f"      [MDM AI] Resolved {entity_type}: '{raw_name}' -> '{match}' (Confidence: {score}%)")
        return match, score
    else:
        # Otherwise, standardize formatting
        cleaned = raw_name.strip().title()
        return cleaned, score


def _persist_resolution(entity_type, raw_value, canonical_value, confidence):
    try:
        from processing.database import register_master_entity
        register_master_entity(entity_type, raw_value, canonical_value, confidence)
    except Exception:
        pass

def apply_mdm(unified_record):
    """
    Applies MDM cleaning rules to a unified record.
    Resolves entity names to maintain a clean master data layer.
    """
    # Clean and resolve customer
    if unified_record.get("customer") and unified_record["customer"].get("name"):
        canonical, confidence = standardize_entity(
            unified_record["customer"]["name"], MASTER_CUSTOMERS, "Customer"
        )
        _persist_resolution("customer", unified_record["customer"]["name"], canonical, confidence)
        unified_record["customer"]["name"] = canonical
    
    # Clean and resolve products
    if unified_record.get("shipment") and unified_record["shipment"].get("product_description"):
        canonical, confidence = standardize_entity(
            unified_record["shipment"]["product_description"], MASTER_PRODUCTS, "Product"
        )
        _persist_resolution("product", unified_record["shipment"]["product_description"], canonical, confidence)
        unified_record["shipment"]["product_description"] = canonical

    if unified_record.get("product") and unified_record["product"].get("name"):
        canonical, confidence = standardize_entity(
            unified_record["product"]["name"], MASTER_PRODUCTS, "Product"
        )
        _persist_resolution("product", unified_record["product"]["name"], canonical, confidence)
        unified_record["product"]["name"] = canonical

    # Clean and resolve locations
    if unified_record.get("shipment"):
        if unified_record["shipment"].get("origin_location"):
            canonical, confidence = standardize_entity(
                unified_record["shipment"]["origin_location"], MASTER_LOCATIONS, "Location"
            )
            _persist_resolution("location", unified_record["shipment"]["origin_location"], canonical, confidence)
            unified_record["shipment"]["origin_location"] = canonical
        
        if unified_record["shipment"].get("destination_location"):
            canonical, confidence = standardize_entity(
                unified_record["shipment"]["destination_location"], MASTER_LOCATIONS, "Location"
            )
            _persist_resolution("location", unified_record["shipment"]["destination_location"], canonical, confidence)
            unified_record["shipment"]["destination_location"] = canonical
            
    return unified_record
