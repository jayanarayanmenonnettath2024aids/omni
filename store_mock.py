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

from fastapi.responses import RedirectResponse

@app.get("/")
def storefront():
    return RedirectResponse(url="http://127.0.0.1:8000/store")

@app.post("/api/order")
def checkout(order: Order):
    try:
        # Pass the order through an API call to the ERP System
        resp = requests.post("http://127.0.0.1:8000/api/order", json=order.dict())
        return resp.json()
    except Exception as e:
        return {"status": "error", "message": "Failed to connect to ERP system. Is it running?"}
