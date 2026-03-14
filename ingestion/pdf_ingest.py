import pdfplumber

try:
    import fitz
except Exception:
    fitz = None

try:
    from rapidocr_onnxruntime import RapidOCR
except Exception:
    RapidOCR = None


_ocr_engine = None


def _get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None and RapidOCR is not None:
        _ocr_engine = RapidOCR()
    return _ocr_engine


def _ocr_pdf(file_path):
    if fitz is None or RapidOCR is None:
        return ""

    engine = _get_ocr_engine()
    if engine is None:
        return ""

    text_chunks = []
    document = fitz.open(file_path)
    try:
        for page in document:
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image_bytes = pix.tobytes("png")
            ocr_result, _elapsed = engine(image_bytes)
            if not ocr_result:
                continue
            page_text = " ".join(item[1] for item in ocr_result if len(item) > 1 and item[1])
            if page_text.strip():
                text_chunks.append(page_text.strip())
    finally:
        document.close()

    return "\n".join(text_chunks)


def extract_pdf_text_and_tables(file_path, enable_ocr=True):
    extracted_text = ""
    extracted_tables = []

    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            # Extract plain text
            text = page.extract_text()
            if text:
                extracted_text += text + "\n"

            # Extract tables
            tables = page.extract_tables()
            for table in tables:
                extracted_tables.append(table)

    if enable_ocr and len(extracted_text.strip()) < 40:
        ocr_text = _ocr_pdf(file_path)
        if ocr_text.strip():
            extracted_text = f"{extracted_text}\n{ocr_text}".strip()

    return extracted_text, extracted_tables