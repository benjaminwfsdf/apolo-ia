# apolo_core.py
import wikipedia
import json
import os
import openai
from datetime import datetime

DATABASE_FILE = 'aprendizaje.json'

def cargar_aprendizaje():
    try:
        with open(DATABASE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def guardar_aprendizaje(base_de_datos):
    with open(DATABASE_FILE, 'w', encoding='utf-8') as f:
        json.dump(base_de_datos, f, indent=4, ensure_ascii=False)

def saludo_según_hora():
    hora_actual = datetime.now().hour
    if 6 <= hora_actual < 12:
        return "¡Buenos días! Soy Apolo."
    elif 12 <= hora_actual < 19:
        return "¡Buenas tardes! Soy Apolo."
    else:
        return "¡Buenas noches! Soy Apolo."

def Clio(pregunta):
    fuentes = "Fuentes confiables: memoriachilena.cl, historiaybiografias.com, enciclopediadehistoria.com."
    respuesta = fuentes

    if "revolución francesa" in pregunta:
        respuesta += " La Revolución Francesa comenzó en 1789 y marcó el fin del absolutismo en Francia."
    elif "segunda guerra mundial" in pregunta:
        respuesta += " La Segunda Guerra Mundial comenzó en 1939 y terminó en 1945, involucrando a muchas naciones y causando millones de muertes."
    elif "independencia de chile" in pregunta:
        respuesta += " La independencia de Chile comenzó en 1810 con la Primera Junta de Gobierno y culminó en 1818 con la Batalla de Maipú."
    elif "dictadura en chile" in pregunta:
        respuesta += " La dictadura en Chile comenzó en 1973 con el golpe militar liderado por Augusto Pinochet y terminó en 1990 con el retorno a la democracia."
    elif "hitos importantes" in pregunta or "momentos clave" in pregunta:
        respuesta += " Algunos hitos importantes incluyen el descubrimiento de América en 1492, la Revolución Industrial en el siglo XVIII, y la caída del Muro de Berlín en 1989."
    elif "colonización" in pregunta:
        respuesta += " La colonización de América comenzó en el siglo XV con la llegada de los europeos, especialmente españoles y portugueses."
    elif "primera guerra mundial" in pregunta:
        respuesta += " La Primera Guerra Mundial ocurrió entre 1914 y 1918, transformando el mapa político de Europa."
    elif "guerra fría" in pregunta:
        respuesta += " La Guerra Fría fue un conflicto político e ideológico entre Estados Unidos y la Unión Soviética desde 1947 hasta 1991."
    else:
        return None
    return respuesta

def Aristoteles(pregunta):
    fuentes = "Fuentes confiables: universoformulas.com, mundoprimaria.com, educapeques.com."
    respuesta = fuentes

    if "teorema de pitágoras" in pregunta:
        respuesta += " El teorema de Pitágoras indica que en un triángulo rectángulo, a² + b² = c²."
    elif "fórmula cuadrática" in pregunta:
        respuesta += " La fórmula cuadrática es: x = (-b ± √(b² - 4ac)) / 2a."
    elif "porcentaje" in pregunta:
        respuesta += " El porcentaje es una forma de expresar una proporción como una fracción de 100."
    elif "área de un círculo" in pregunta:
        respuesta += " El área de un círculo se calcula con la fórmula π·r², donde r es el radio."
    elif "perímetro de un cuadrado" in pregunta:
        respuesta += " El perímetro de un cuadrado es igual a 4 por el valor de un lado."
    else:
        return None
    return respuesta

def Mendel(pregunta):
    fuentes = "Fuentes confiables: astromia.com, lifeder.com, educ.ar."
    respuesta = fuentes

    if "genética" in pregunta:
        respuesta += " Gregor Mendel descubrió las leyes de la herencia genética mediante experimentos con plantas."
    elif "cambio climático" in pregunta:
        respuesta += " El cambio climático se refiere a cambios globales en el clima, provocados principalmente por la actividad humana."
    elif "leyes de la termodinámica" in pregunta:
        respuesta += " Las leyes de la termodinámica explican cómo se transfiere la energía en forma de calor y trabajo."
    elif "sistema solar" in pregunta:
        respuesta += " El sistema solar está compuesto por el Sol, ocho planetas, lunas y otros cuerpos celestes."
    elif "célula" in pregunta:
        respuesta += " La célula es la unidad básica de la vida, puede ser procariota o eucariota."
    else:
        return None
    return respuesta

def Esteban(pregunta):
    fuentes = "Fuentes confiables: materialesdelengua.org, revistaeducarnos.com, lengua.pro."
    respuesta = fuentes

    if "verbo" in pregunta:
        respuesta += " Un verbo indica acción, estado o proceso en una oración."
    elif "sustantivo" in pregunta:
        respuesta += " Un sustantivo es una palabra que nombra personas, objetos, lugares o ideas."
    elif "adjetivo" in pregunta:
        respuesta += " Un adjetivo describe o califica a un sustantivo."
    elif "conectores" in pregunta:
        respuesta += " Los conectores enlazan oraciones o ideas para dar coherencia al discurso."
    else:
        return None
    return respuesta

def Colon(pregunta):
    fuentes = "Fuentes confiables: geografia-infantil.com, nationalgeographicla.com, un.org/es/climatechange."
    respuesta = fuentes

    if "latitud" in pregunta:
        respuesta += " La latitud es la distancia angular entre un punto de la Tierra y el ecuador."
    elif "longitud" in pregunta:
        respuesta += " La longitud es la distancia angular respecto al meridiano de Greenwich."
    elif "continentes" in pregunta:
        respuesta += " Los continentes son grandes extensiones de tierra: América, Europa, África, Asia, Oceanía y la Antártida."
    elif "cambio climático" in pregunta:
        respuesta += " El cambio climático afecta el equilibrio ambiental y provoca fenómenos extremos como sequías e inundaciones."
    else:
        return None
    return respuesta

def buscar_en_wikipedia(pregunta):
    try:
        wikipedia.set_lang("es")
        return wikipedia.summary(pregunta, sentences=2)
    except:
        return None

def consulta_openai(pregunta):
    openai.api_key = os.getenv("OPENAI_API_KEY")
    try:
        respuesta = openai.ChatCompletion.create(
           model="gpt-4o",  

            messages=[
                {"role": "system", "content": "Eres Apolo, un sabio oráculo griego que responde con claridad."},
                {"role": "user", "content": pregunta}
            ],
            temperature=0.7
        )
        return respuesta.choices[0].message["content"].strip()
    except Exception as e:
        return "No logré conectar con el oráculo superior. Intenta más tarde."

def generar_respuesta(texto):
    base_de_datos = cargar_aprendizaje()

    if texto in base_de_datos.get('aprendizaje', {}):
        return base_de_datos['aprendizaje'][texto]

    respuesta = (
        Clio(texto) or
        Aristoteles(texto) or
        Mendel(texto) or
        Esteban(texto) or
        Colon(texto) or
        buscar_en_wikipedia(texto)
    )

    if respuesta is None:
        respuesta = consulta_openai(texto)

    base_de_datos.setdefault('aprendizaje', {})[texto] = respuesta
    guardar_aprendizaje(base_de_datos)

    return respuesta 

