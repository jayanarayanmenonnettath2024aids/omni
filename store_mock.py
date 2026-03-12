from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
import requests
import os

app = FastAPI()

class Order(BaseModel):
    client_name: str
    item: str
    qty: int
    rate: float

@app.get("/", response_class=HTMLResponse)
def storefront():
    file_path = os.path.join(os.path.dirname(__file__), "storefront.html")
    with open(file_path, "r", encoding="utf-8") as f:
        html_content = f.read()
    return html_content

@app.post("/api/order")
def checkout(order: Order):
    try:
        # Pass the order through an API call to the ERP System
        resp = requests.post("http://127.0.0.1:8000/api/order", json=order.dict())
        return resp.json()
    except Exception as e:
        return {"status": "error", "message": "Failed to connect to ERP system. Is it running?"}
