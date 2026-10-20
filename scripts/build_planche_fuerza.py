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

planche_models = [
  model("pl-r1", "Tuck Planche R1", 2, 20, [
    blk("biseries", 4, 180, exercises=[ex("De pica a tuck planche (sin levantar)", reps="3-4"), ex("Lean Planche", 10)]),
    blk("biseries", 3, 150, exercises=[ex("Flexiones lean planche", reps="3-4"), ex("Lean Planche", 10)]),
    blk("biseries", 3, 150, exercises=[ex("Flexiones en pica 90°", reps="6-10"), ex("Plank Hold", 20)]),
    blk("single", 3, 90, exercises=[ex("Flexiones normales", reps="8-10")]),
  ]),
  model("pl-r2", "Tuck Planche R2", 2, 20, [
    blk("single", 3, 90, exercises=[ex("Lean caminando", 20)]),
    blk("biseries", 3, 150, exercises=[ex("De pica a lean planche (completos)", reps="4"), ex("Lean planche", 10)]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones Diamante", reps="5-8"), ex("Flexiones normales", 10, notes="6-10s")]),
    blk("single", 3, 120, exercises=[ex("Flexiones en pica", reps="6-10")]),
  ]),
  model("pl-r3", "Tuck Planche R3", 3, 20, [
    blk("single", 2, 90, exercises=[ex("Flexiones normales", reps="10")]),
    blk("biseries", 4, 180, exercises=[ex("De pica a lean planche (completos)", reps="4"), ex("Lean planche", 10)]),
    blk("single", 3, 150, exercises=[ex("Flexiones lean planche", reps="5-7")]),
    blk("single", 3, 150, exercises=[ex("Flexiones en pica", reps="6-10")]),
  ]),
  model("pl-r4", "Tuck Planche R4", 3, 20, [
    blk("biseries", 4, 180, exercises=[ex("De pica a tuck planche (sin levantar)", reps="3-4"), ex("Lean Planche", 10)]),
    blk("biseries", 4, 150, exercises=[ex("Flexiones en lean planche", reps="4-6"), ex("Lean Planche", 10)]),
    blk("biseries", 3, 150, exercises=[ex("De pica a lean planche", reps="4"), ex("Lean Planche", 10)]),
    blk("single", 3, 150, exercises=[ex("Flexiones normales", reps="8-12")]),
  ]),
  model("pl-r5", "Tuck Planche R5", 3, 20, [
    blk("single", 5, 150, exercises=[ex("Frog Planche hold", 10, notes="10+s")]),
    blk("biseries", 4, 180, exercises=[ex("De pica a tuck planche (sin levantar)", reps="3-4"), ex("Lean planche", 10)]),
    blk("single", 4, 150, exercises=[ex("Flexiones en lean planche", reps="6-8")]),
    blk("single", 3, 150, exercises=[ex("Flexiones en pica", reps="6-10")]),
  ]),
  model("pl-pro1", "PRO1", 3, 20, [
    blk("single", 5, 150, exercises=[ex("Intentos Tuck Planche", 10, notes="5-10s")]),
    blk("single", 4, 180, exercises=[ex("De pica a tuck planche (despegando pies)", reps="2-3")]),
    blk("biseries", 3, 150, exercises=[ex("Flexiones lean planche", reps="4-6"), ex("Lean planche", 10)]),
    blk("single", 3, 150, exercises=[ex("Flexiones en pica", reps="6-10")]),
  ]),
]

planche_program = {
  "id": "planche-fuerza",
  "categoryId": "planche",
  "name": "Planche (fuerza)",
  "level": "intermediate",
  "description": "Fuerza sin equipamiento: intensidad 2/3, R1-R5 + PRO1.",
  "objectives": ["Ganar fuerza de planche", "Progresar en palancas"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48-72h",
  "rules": ["No hacer más de 4 series en pino por fuerza.", "Descansos de al menos 3 min en pino por fuerza."],
  "optional": True,
  "models": planche_models,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "planche":
        # keep existing programs (resistencia) if any; append/replace fuerza
        progs = [p for p in c["programs"] if p["id"] != "planche-fuerza"]
        progs.append(planche_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("planche fuerza merged:", len(planche_models), "models")
