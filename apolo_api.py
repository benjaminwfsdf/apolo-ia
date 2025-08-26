# apolo_api.py
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from apolo_core import generar_respuesta, saludo_según_hora

app = FastAPI()

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