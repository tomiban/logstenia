import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data", "plans.json")

def ex(name, timeSec=None, reps=None, cadence=None, notes=None):
    e = {"name": name}
    if timeSec is not None: e["timeSec"] = timeSec
    if reps is not None: e["reps"] = reps
    if cadence: e["cadence"] = cadence
    if notes: e["notes"] = notes
    return e

def blk(type_, sets, restSets, restEx=None, exercises=None):
    b = {"type": type_, "sets": sets, "restBetweenSetsSec": restSets, "exercises": exercises or []}
    if restEx is not None: b["restBetweenExercisesSec"] = restEx
    return b

def model(mid, name, intensity, total, blocks):
    return {"id": mid, "name": name, "intensity": intensity, "totalTimeMin": total, "blocks": blocks}

movilidad_models = [
  model("mov-m1", "Calentamiento y Flex, hombro, pecho y biceps.", 1, 12, [
    blk("single", 1, 0, exercises=[ex("Movilización de hombros alternando ambos brazos (sin banda)", 30)]),
    blk("single", 2, 20, exercises=[ex("Rotaciones de hombro en suelo (sin tocar el suelo)", reps="6")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento de pectoral y deltoides anterior (isometría en suelo)", 20, notes="x brazo, 15-20s")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento biceps/hombro/pectoral (brazo apoyado en suelo)", 20, notes="x brazo, 15-20s")]),
    blk("single", 2, 10, exercises=[ex("Predicador en suelo (estiramiento de hombros)", 20, notes="15-20s")]),
  ]),
  model("mov-m2", "Calentamiento y Flex de Dorsal, trapecios y serratos.", 1, 12, [
    blk("single", 2, 15, exercises=[ex("Remo con banda elástica", reps="15")]),
    blk("single", 3, 15, exercises=[ex("Dominadas escapulares (estiramiento y contracción)", 20, notes="15-20s")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento para dorsal en barra horizontal", 20, notes="x brazo, 15-20s")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento dorsal y serratos en barra (trasero atrás)", 20, notes="x brazo")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento de trapecios (trasero adelante)", 20, notes="15-20s")]),
  ]),
  model("mov-m3", "Mov. Y Flex de pierna y cadera.", 1, 14, [
    blk("single", 2, 0, exercises=[ex("Patadas frontales rodilla estirada", 20, notes="x pierna, 15-20s")]),
    blk("single", 2, 0, exercises=[ex("Patada frontal + rotación lateral", 20, notes="x pierna, 15-20s")]),
    blk("single", 2, 0, exercises=[ex("Patadas laterales", 20, notes="x pierna, 15-20s")]),
    blk("single", 1, 0, exercises=[ex("Isométrico de sentadilla sumo (aductores)", 60, notes="1 min por pierna, cambio cada 10s")]),
    blk("single", 2, 0, exercises=[ex("Movilidad de cadera", 20, notes="15-20s")]),
    blk("single", 2, 15, exercises=[ex("Aperturas en cuclillas (pies juntos, talones en suelo)", 20)]),
    blk("single", 3, 0, exercises=[ex("Estiramiento pierna lateral en cuclillas", 30, notes="15s isometría + 15s rotación femur, x pierna")]),
  ]),
  model("mov-m4", "Mov y flex de cadera e isquios", 1, 14, [
    blk("single", 2, 0, exercises=[ex("Botes en mariposa (cadencia 7-7)", reps="4")]),
    blk("single", 2, 0, exercises=[ex("Apertura en rana (isometría)", 30, notes="20-30s")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento de glúteos en suelo", 20, notes="15-20s")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento de isquios (flex frontal)", 25, notes="20-25s")]),
    blk("single", 1, 0, exercises=[ex("Apertura de pie asistida (en pared)", 20, notes="15-20s")]),
    blk("single", 3, 0, exercises=[ex("Apertura de piernas sentado (pecho al suelo)", 15, notes="10-15s por posición")]),
  ]),
  model("mov-m5", "PRE-ENTRENAMIENTO", 1, 12, [
    blk("single", 2, 0, exercises=[ex("Rotación externa + press de hombro con banda", reps="10")]),
    blk("single", 2, 0, exercises=[ex("Curl de bíceps con banda + excéntrico de hombro frontal", reps="8")]),
    blk("single", 2, 0, exercises=[ex("Flexiones escapulares en suelo (explosividad leve)", reps="10")]),
    blk("single", 2, 0, exercises=[ex("Predicador en suelo para hombro", 20)]),
    blk("single", 2, 0, exercises=[ex("Sentadillas arqueras (max. profundidad)", reps="6-8")]),
    blk("single", 3, 0, exercises=[ex("Apertura de piernas de pie", reps="15-20")]),
    blk("single", 2, 0, exercises=[ex("Dominadas escapulares explosivas", reps="8-10")]),
  ]),
  model("mov-m6", "Mov y flex de hombros.", 1, 12, [
    blk("single", 1, 0, exercises=[ex("Rotadores de hombro interno (ambos brazos)", reps="15-20")]),
    blk("single", 1, 0, exercises=[ex("Rotadores externos de hombro (ambos brazos)", reps="15-20")]),
    blk("single", 2, 0, exercises=[ex("Rotaciones en cristo con goma", reps="10-15")]),
    blk("single", 2, 0, exercises=[ex("Rotaciones + press de hombro con goma", 15, notes="x brazo, 10-15s")]),
    blk("single", 2, 0, exercises=[ex("Predicador (cerrado y agarre abierto)", 20, notes="15-20s cada")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento de infraespinoso (barra/pared)", 20, notes="15-20s")]),
  ]),
  model("mov-m7", "Mov y flex de muñecas y antebrazo", 1, 10, [
    blk("single", 2, 0, exercises=[ex("Rotaciones de muñeca con banda", 20, notes="x brazo, 20s")]),
    blk("single", 2, 0, exercises=[ex("Cambios de mano colgado en barra", reps="8")]),
    blk("single", 2, 0, exercises=[ex("Elevaciones de muñeca en flexión", 20)]),
    blk("single", 2, 0, exercises=[ex("Estiramiento de muñecas de rodillas", 30, notes="10-15s adelante + 10-15s detrás")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento agarre falso supino en barra", 20, notes="15-20s")]),
  ]),
  model("mov-m8", "Flex de hombro", 1, 12, [
    blk("single", 2, 20, exercises=[ex("Rotación de hombro tumbado boca abajo (x8 rotaciones)", reps="8")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento biceps/hombro/pectoral", 20, notes="15-20s")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento pectoral y deltoide (codo 90°, isometría)", 20, notes="x brazo, 15-20s")]),
    blk("single", 3, 20, exercises=[ex("Predicador para hombros (de rodillas)", 20)]),
    blk("single", 3, 0, exercises=[ex("Dislocaciones completas con banda", reps="10")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento de deltoides anterior y bíceps", 20, notes="15-20s")]),
    blk("single", 2, 0, exercises=[ex("Estiramiento para infraespinoso (pared/barra)", 20, notes="15-20s")]),
  ]),
]

movilidad_program = {
  "id": "movilidad-general",
  "categoryId": "movilidad",
  "name": "Movilidad & Flexibilidad",
  "level": "beginner",
  "description": "Calentamiento y movilidad por grupo muscular: 8 modelos para antes/después de entrenar.",
  "objectives": ["Calentar correctamente", "Mejorar la movilidad general", "Optimizar la condición del cuerpo al entrenamiento"],
  "goals": [
    {"id": "mov-diario", "name": "Días de movilidad", "unit": "reps", "target": 7}
  ],
  "frequency": "diario",
  "restBetweenSessions": "24h",
  "rules": ["Hacer algo de movilidad cada día.", "Se puede elegir el modelo que mejor se adapte al entrenamiento del día."],
  "models": movilidad_models,
}

# Merge into existing plans.json
with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "movilidad":
        c["programs"] = [movilidad_program]

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("movilidad merged:", len(movilidad_models), "models")
