# apolo_api.py
from fastapi import FastAPI
from pydantic import BaseModel
import os
from fastapi.middleware.cors import CORSMiddleware
from apolo_core import generar_respuesta, saludo_según_hora

app = FastAPI()

@app.get("/capabilities")
def capabilities():
    return {"paid_ai_enabled": os.getenv("APOLO_ENABLE_PAID_AI", "false").lower() == "true"}

# Permitir peticiones desde frontend local
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, cambia esto a tu dominio
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Pregunta(BaseModel):
    texto: str

@app.get("/")
def inicio():
    return {"mensaje": saludo_según_hora()}

@app.post("/preguntar")
def preguntar(p: Pregunta):
    respuesta = generar_respuesta(p.texto.lower())
    return {"respuesta": respuesta}
