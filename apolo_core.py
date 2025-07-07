import wikipedia
import json
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
        respuesta += " La Revolución Francesa comenzó en 1789 y terminó en 1799. Fue un proceso político y social que marcó el fin de la monarquía absoluta en Francia y el inicio de una era republicana basada en los principios de libertad, igualdad y fraternidad."
    elif "segunda guerra mundial" in pregunta:
        respuesta += " La Segunda Guerra Mundial fue un conflicto global que duró de 1939 a 1945, involucrando a la mayoría de las naciones del mundo. Fue provocada por la expansión nazi liderada por Adolf Hitler y terminó con la rendición de Alemania y Japón."
    elif "independencia de chile" in pregunta:
        respuesta += " La independencia de Chile se inició en 1810 con la Primera Junta Nacional de Gobierno y culminó en 1818 con la victoria patriota en la Batalla de Maipú. Marcó el fin del dominio colonial español en el territorio chileno."
    elif "dictadura en chile" in pregunta:
        respuesta += " La dictadura en Chile comenzó el 11 de septiembre de 1973 con un golpe de Estado liderado por Augusto Pinochet, derrocando al presidente Salvador Allende. El régimen militar duró hasta 1990 y estuvo marcado por graves violaciones a los derechos humanos."
    elif "hitos importantes" in pregunta or "momentos clave" in pregunta:
        respuesta += " Algunos hitos importantes de la historia mundial incluyen el descubrimiento de América en 1492, la Revolución Industrial en el siglo XVIII, la caída del Muro de Berlín en 1989 y la llegada del hombre a la Luna en 1969."
    elif "colonización" in pregunta:
        respuesta += " La colonización de América comenzó en el siglo XV con la llegada de Cristóbal Colón. España y Portugal fueron los primeros colonizadores, imponiendo su cultura, idioma y religión, con un profundo impacto en las civilizaciones indígenas."
    elif "primera guerra mundial" in pregunta:
        respuesta += " La Primera Guerra Mundial ocurrió entre 1914 y 1918. Fue provocada por tensiones entre potencias europeas y el asesinato del archiduque Francisco Fernando. Terminó con el Tratado de Versalles y dejó millones de muertos."
    elif "guerra fría" in pregunta:
        respuesta += " La Guerra Fría fue un conflicto político e ideológico entre Estados Unidos y la Unión Soviética, que duró desde 1947 hasta 1991. Aunque no hubo enfrentamiento directo, se manifestó en guerras por poder, espionaje y la carrera armamentista."
    else:
        return None
    return respuesta

def Aristoteles(pregunta):
    fuentes = "Fuentes confiables: universoformulas.com, mundoprimaria.com, educapeques.com."
    respuesta = fuentes

    if "teorema de pitágoras" in pregunta:
        respuesta += " El teorema de Pitágoras establece que en un triángulo rectángulo, el cuadrado de la hipotenusa es igual a la suma de los cuadrados de los catetos. Es decir, a² + b² = c²."
    elif "fórmula cuadrática" in pregunta:
        respuesta += " La fórmula cuadrática se usa para resolver ecuaciones de segundo grado y es: x = (-b ± √(b² - 4ac)) / (2a)."
    elif "porcentaje" in pregunta:
        respuesta += " El porcentaje es una forma de expresar una cantidad como una fracción de 100. Por ejemplo, 25% representa 25 de cada 100 unidades."
    elif "área de un círculo" in pregunta:
        respuesta += " El área de un círculo se calcula con la fórmula: área = π × r², donde r es el radio del círculo."
    elif "perímetro de un cuadrado" in pregunta:
        respuesta += " El perímetro de un cuadrado se obtiene multiplicando la longitud de uno de sus lados por 4. Es decir, P = 4 × lado."
    else:
        return None
    return respuesta

def Mendel(pregunta):
    fuentes = "Fuentes confiables: astromia.com, lifeder.com, educ.ar."
    respuesta = fuentes

    if "genética" in pregunta:
        respuesta += " Gregor Mendel, a través de experimentos con plantas de arveja, descubrió las leyes fundamentales de la herencia genética. Estas leyes explican cómo se transmiten los rasgos de una generación a otra."
    elif "cambio climático" in pregunta:
        respuesta += " El cambio climático es la variación a largo plazo de los patrones del clima terrestre. Está causado principalmente por la actividad humana, como la quema de combustibles fósiles y la deforestación, lo que aumenta los gases de efecto invernadero."
    elif "leyes de la termodinámica" in pregunta:
        respuesta += " Las leyes de la termodinámica describen cómo se transfiere la energía en forma de calor y trabajo. Son fundamentales en física, química y otras ciencias aplicadas."
    elif "sistema solar" in pregunta:
        respuesta += " El sistema solar está compuesto por el Sol y todos los cuerpos celestes que orbitan a su alrededor, incluidos ocho planetas, satélites, asteroides y cometas."
    elif "célula" in pregunta:
        respuesta += " La célula es la unidad estructural y funcional básica de los seres vivos. Puede ser procariota (sin núcleo definido) o eucariota (con núcleo definido)."
    else:
        return None
    return respuesta

def Esteban(pregunta):
    fuentes = "Fuentes confiables: materialesdelengua.org, revistaeducarnos.com, lengua.pro."
    respuesta = fuentes

    if "verbo" in pregunta:
        respuesta += " Un verbo es una palabra que indica acción, estado o proceso. Es el núcleo del predicado en una oración."
    elif "sustantivo" in pregunta:
        respuesta += " Un sustantivo es una palabra que nombra personas, animales, cosas, lugares o ideas. Puede ser común o propio."
    elif "adjetivo" in pregunta:
        respuesta += " Un adjetivo es una palabra que acompaña al sustantivo para calificarlo o determinarlo, proporcionando información adicional."
    elif "conectores" in pregunta:
        respuesta += " Los conectores son palabras o frases que enlazan ideas o partes de un texto para darle coherencia, como 'además', 'por lo tanto', o 'sin embargo'."
    else:
        return None
    return respuesta

def Colon(pregunta):
    fuentes = "Fuentes confiables: geografia-infantil.com, nationalgeographicla.com, un.org/es/climatechange."
    respuesta = fuentes

    if "latitud" in pregunta:
        respuesta += " La latitud es la distancia angular entre un punto de la Tierra y el ecuador. Se mide en grados de 0° a 90° hacia el norte o sur."
    elif "longitud" in pregunta:
        respuesta += " La longitud es la distancia angular entre un punto y el meridiano de Greenwich. Se mide en grados de 0° a 180° hacia el este o el oeste."
    elif "continentes" in pregunta:
        respuesta += " Los continentes son grandes masas de tierra emergida del planeta. Hay siete: América, Europa, Asia, África, Oceanía, la Antártida y, según algunos, se considera Eurasia como uno solo."
    elif "cambio climático" in pregunta:
        respuesta += " El cambio climático provoca alteraciones en el clima del planeta, incluyendo fenómenos extremos como sequías, inundaciones y derretimiento de los glaciares."
    else:
        return None
    return respuesta

def buscar_en_wikipedia(pregunta):
    try:
        wikipedia.set_lang("es")
        return wikipedia.summary(pregunta, sentences=2)
    except:
        return "No encontré información clara. Intenta reformular la pregunta."

def generar_respuesta(texto):
    base_de_datos = cargar_aprendizaje()

    if texto in base_de_datos.get('aprendizaje', {}):
        return base_de_datos['aprendizaje'][texto]

    respuesta = (
        Clio(texto) or
        Aristoteles(texto) or
        Mendel(texto) or
        Esteban(texto) or
        Colon(texto)
    )

    if respuesta is None:
        respuesta = buscar_en_wikipedia(texto)

    base_de_datos.setdefault('aprendizaje', {})[texto] = respuesta
    guardar_aprendizaje(base_de_datos)

    return respuesta
