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

hefesto_models = [
  model("hef-h1", "Modelo H1", 1, 20, [
    blk("single", 4, 90, restEx=120, exercises=[ex("Simulación curl Hefesto (banda detrás)", reps="15-20", cadence="3:1")]),
    blk("single", 3, 90, restEx=120, exercises=[ex("Flexiones en supino", reps="7", cadence="3:1")]),
    blk("single", 3, 90, restEx=120, exercises=[ex("Skin the cat (supino)", reps="5-7", cadence="3:1")]),
    blk("single", 3, 90, restEx=120, exercises=[ex("Curl de bíceps a la frente (barra baja)", reps="12", cadence="3:3")]),
  ]),
  model("hef-h2", "Modelo H2", 2, 20, [
    blk("single", 5, 90, restEx=120, exercises=[ex("Neg. Hefesto asistido (barra baja)", reps="5", cadence="3:0", notes="pies en línea de la barra")]),
    blk("single", 3, 90, restEx=120, exercises=[ex("Flexiones pica a horizontal (supino)", reps="7", cadence="3:1")]),
    blk("single", 3, 90, restEx=120, exercises=[ex("Fondos profundos", reps="8-10", cadence="3:1")]),
    blk("single", 3, 90, restEx=120, exercises=[ex("Curl de bíceps a la frente (barra baja)", reps="12", cadence="3:3")]),
  ]),
  model("hef-h3", "Modelo H3", 3, 20, [
    blk("single", 5, 90, restEx=120, exercises=[ex("Hefesto asistido (barra baja)", reps="5", cadence="3:1", notes="pies detrás de la línea")]),
    blk("biseries", 3, 90, restEx=120, exercises=[ex("Medio Skin the cat (cabeza y doblado)", reps="1", cadence="3:1"), ex("7 Flexiones progresivas a posición final de skin", reps="7", cadence="3:1")]),
    blk("single", 4, 90, restEx=120, exercises=[ex("Korean dips (agarre supino)", reps="10-12", cadence="3:1")]),
    blk("single", 4, 90, restEx=120, exercises=[ex("Curl de bíceps a la frente (barra baja)", reps="10-12", cadence="3:3")]),
  ]),
]

hefesto_program = {
  "id": "hefesto-principiantes",
  "categoryId": "hefesto",
  "name": "Hefesto Principiante",
  "level": "beginner",
  "description": "Acondicionamiento + H1/H2/H3 con equipamiento (3 intensidades).",
  "objectives": ["Acondicionar el cuerpo a la biomecánica del hefesto", "Desarrollar agarre falso en supinación", "Ganar fuerza de jalón"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "2-3 días",
  "rules": ["Descanso 1-2 min entre series y 2-3 min entre ejercicios.", "Cadencia 3:1 (negativa:positiva)."],
  "models": hefesto_models,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "hefesto":
        progs = [p for p in c["programs"] if p["id"] != "hefesto-principiantes"]
        progs.append(hefesto_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("hefesto merged:", len(hefesto_models), "models")
