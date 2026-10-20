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

eq_models = [
  model("pleq-r1", "Tuck Planche R1 (eq)", 2, 20, [
    blk("single", 4, 180, exercises=[ex("Max Hold Tuck Planche", reps="max", notes="max seg")]),
    blk("single", 3, 240, exercises=[ex("De pica a tuck planche (marcando tuck 1-2s)", reps="4-5")]),
    blk("single", 4, 180, exercises=[ex("Flexiones en pica 90°", reps="4-8")]),
    blk("single", 3, 180, exercises=[ex("Flexiones lean planche", reps="7")]),
  ]),
  model("pleq-r2", "Tuck Planche R2 (eq)", 2, 20, [
    blk("single", 3, 90, exercises=[ex("Lean caminando", 20)]),
    blk("single", 4, 180, exercises=[ex("Lean con rodillas en suelo (intentar despegar)", 15)]),
    blk("biseries", 4, 210, exercises=[ex("Tuck planche", 10, notes="6-10s"), ex("Flexiones lean planche", reps="5-7")]),
    blk("single", 3, 90, exercises=[ex("Flexiones en diamante", reps="10-15")]),
  ]),
  model("pleq-r3", "Tuck Planche R3 (eq)", 3, 20, [
    blk("single", 3, 90, exercises=[ex("Lean planche", 15)]),
    blk("biseries", 4, 240, exercises=[ex("Flexiones tuck planche", reps="4-6"), ex("Hold tuck planche", reps="max", notes="max seg")]),
    blk("biseries", 4, 180, exercises=[ex("Flexiones lean supina explosivas", reps="5"), ex("Hold lean supina", 10)]),
    blk("biseries", 3, 180, exercises=[ex("De pica a lean planche", reps="5"), ex("Lean planche", 10)]),
  ]),
  model("pleq-r4", "Tuck Planche R4 (eq)", 3, 20, [
    blk("biseries", 4, 240, exercises=[ex("De pica a tuck advanced", reps="4"), ex("Lean Planche", 10)]),
    blk("biseries", 3, 240, exercises=[ex("Flexiones en tuck planche", reps="3-4"), ex("Hold tuck planche", 5)]),
    blk("biseries", 3, 210, exercises=[ex("Flexiones en pica 90°", reps="3-4"), ex("Flexiones lean planche", reps="3-4")]),
    blk("single", 3, 150, exercises=[ex("Flexiones supinas", reps="10-12")]),
  ]),
  model("pleq-r5", "Tuck Planche R5 (eq)", 3, 20, [
    blk("single", 4, 180, exercises=[ex("Intentos lean rodillas en suelo", 15, notes="levanta")]),
    blk("biseries", 4, 180, exercises=[ex("Flexiones en lean planche explosivas", reps="5"), ex("Lean planche supina", 10)]),
    blk("biseries", 3, 180, exercises=[ex("De pica a lean planche", reps="5"), ex("Lean planche", 10)]),
    blk("single", 3, 180, exercises=[ex("Flexiones en pica 90°", reps="6-8")]),
  ]),
  model("pleq-pro1", "PRO1", 3, 20, [
    blk("single", 4, 180, exercises=[ex("Lean rodillas en suelo (levantando)", 10, notes="6-10s")]),
    blk("single", 3, 240, exercises=[ex("De pica a tuck advanced (despegando pies)", reps="4")]),
    blk("biseries", 3, 240, exercises=[ex("Flexiones tuck planche", reps="3-4"), ex("Tuck planche", 10, notes="6-10s")]),
    blk("biseries", 4, 180, exercises=[ex("Flexiones lean planche explosivas supinas", reps="5"), ex("Lean planche supina", 10)]),
  ]),
]

eq_program = {
  "id": "planche-fuerza-eq",
  "categoryId": "planche",
  "name": "Planche (fuerza) - con equipamiento",
  "level": "intermediate",
  "description": "Fuerza con equipamiento: intensidad 2/3, R1-R5 + PRO1.",
  "objectives": ["Ganar fuerza de planche con equipamiento"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48-72h",
  "rules": ["Descansos largos entre series."],
  "optional": True,
  "models": eq_models,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "planche":
        progs = [p for p in c["programs"] if p["id"] != "planche-fuerza-eq"]
        progs.append(eq_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("planche fuerza (eq) merged:", len(eq_models), "models")
