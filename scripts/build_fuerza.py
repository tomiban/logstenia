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

fuerza_models = [
  model("fz-b1", "Modelo B1", 2, 20, [
    blk("single", 3, 120, exercises=[ex("Dominadas prona asistidas (banda)", reps="4-8")]),
    blk("biseries", 3, 120, exercises=[ex("Salto a isométrico arriba en dominada supina", reps="2-3"), ex("Excéntrica de dominada supina", reps="3-5", notes="3-5s")]),
    blk("biseries", 3, 105, exercises=[ex("Fondos en banco", reps="8-12"), ex("Reverse planche hold (tríceps)", 10)]),
    blk("single", 3, 105, exercises=[ex("Flexiones normales (cadencia 2s hold abajo/arrriba)", reps="6-10")]),
    blk("single", 3, 120, exercises=[ex("Australian pull ups pronas", reps="8-12")]),
  ]),
  model("fz-b2", "Modelo B2", 2, 20, [
    blk("biseries", 3, 105, exercises=[ex("Flexiones en pica (rango parcial)", reps="4-8"), ex("Descenso de pica a lean (en pasos)", reps="3")]),
    blk("single", 4, 150, exercises=[ex("Dominadas supinas (rango parcial)", reps="4-8")]),
    blk("biseries", 3, 120, exercises=[ex("Salto a fondo en barra", reps="6-10"), ex("Flexiones inclinadas explosivas", reps="8-12")]),
    blk("biseries", 4, 90, exercises=[ex("Knee raises laterales (colgado)", 20), ex("Australian pull ups supinas", reps="8-12")]),
  ]),
  model("fz-b3", "Modelo B3", 2, 20, [
    blk("single", 4, 150, exercises=[ex("Dominadas pronas asistidas (banda)", reps="4-8")]),
    blk("single", 3, 120, exercises=[ex("Dominadas supina (cadencia 2-2-2)", reps="4-8")]),
    blk("superseries", 3, 90, exercises=[ex("Leg raises colgado", 20), ex("Knee raises laterales", 20), ex("Australian pull ups", reps="6-12")]),
    blk("biseries", 2, 60, exercises=[ex("Curl de bíceps con banda", reps="6-12"), ex("Remos con banda (a la cadera)", reps="6-12")]),
  ]),
  model("fz-b4", "Modelo B4", 2, 20, [
    blk("biseries", 4, 120, exercises=[ex("Botes en rana (cada pierna)", reps="4-8"), ex("Flexiones en pica", reps="6-12")]),
    blk("biseries", 4, 105, exercises=[ex("Enterradoras de tríceps", reps="6-10"), ex("Reverse lean planche", 10)]),
    blk("single", 3, 60, exercises=[ex("Australian pull ups pronas explosivas", reps="8-12")]),
    blk("biseries", 2, 120, exercises=[ex("Flexiones supinas (barra baja)", reps="6-10"), ex("Flexiones normales", reps="4-8")]),
  ]),
  model("fz-b5", "Modelo B5", 3, 20, [
    blk("single", 4, 150, exercises=[ex("Dominadas pronas con salto (cadencia 2-2-2)", reps="3-6", notes="empezar desde arriba")]),
    blk("single", 3, 105, exercises=[ex("Fondos normales (banda)", reps="6-12")]),
    blk("superseries", 3, 60, exercises=[ex("Leg raises colgado", 20), ex("Knee raises laterales", 20), ex("Plank a planche", 20)]),
    blk("biseries", 3, 105, exercises=[ex("Flexiones supinas (miniparalelas)", reps="6-12"), ex("Lean planche", 10)]),
  ]),
  model("fz-b6", "Modelo B6", 3, 20, [
    blk("biseries", 4, 120, exercises=[ex("Flexiones en pica (semiprofundas)", reps="4-8"), ex("Lean planche", 15)]),
    blk("single", 3, 105, exercises=[ex("Fondos en paralelas (parciales)", reps="6-12")]),
    blk("biseries", 3, 105, exercises=[ex("Flexiones con cadencia 2-1-2", reps="4-8"), ex("Plank en suelo", 20)]),
    blk("biseries", 3, 105, exercises=[ex("Fondos en banco", reps="6-12"), ex("Reverse lean planche", 10)]),
  ]),
  model("fz-b7", "Modelo B7", 3, 20, [
    blk("single", 4, 120, exercises=[ex("De pica a lean planche (con pasos + flexión)", reps="4-8")]),
    blk("biseries", 3, 105, exercises=[ex("Australian invertida (supino)", reps="4-8"), ex("Lean planche (supino)", 10)]),
    blk("superseries", 3, 150, exercises=[ex("Flexiones diamante", reps="4-8"), ex("Flexiones normales (ancho poco más que hombro)", reps="4-8"), ex("Flexiones abiertas", reps="4-8")]),
    blk("single", 3, 90, exercises=[ex("Leg raises en paralelas (isométría 2-3s arriba)", reps="4-8")]),
  ]),
  model("fz-b8", "Modelo B8", 3, 20, [
    blk("single", 4, 120, exercises=[ex("Dominada supina (barbilla por encima)", reps="4-8")]),
    blk("superseries", 3, 120, exercises=[ex("Australian pull up (agarre prono abierto)", reps="4-6"), ex("Australian pull up (agarre prono estándar)", reps="4-6"), ex("Australian pull up (agarre supino)", reps="4-6")]),
    blk("biseries", 3, 90, exercises=[ex("Leg raises y knee raises (alternando colgado)", 20), ex("Plancha lateral dinámica", 15, notes="cada lado")]),
    blk("biseries", 3, 120, exercises=[ex("Pull ups de hefesto asistido", reps="6-12", notes="seg"), ex("Lean planche supina", 10)]),
  ]),
]

fuerza_program = {
  "id": "fuerza-principiantes",
  "categoryId": "fuerza",
  "name": "Fuerza Principiante",
  "level": "beginner",
  "description": "8 modelos B1-B8 (principiantes/intermedios/avanzados básicos).",
  "objectives": ["Ganar fuerza base", "Preparar para elementos avanzados"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48h",
  "rules": ["Calentamiento de movilidad articular general + específico."],
  "models": fuerza_models,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "fuerza":
        c["programs"] = [fuerza_program]

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("fuerza merged:", len(fuerza_models), "models")
