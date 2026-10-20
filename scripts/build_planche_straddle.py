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

straddle_models = [
  model("str-r1", "Straddle R1", 2, 20, [
    blk("biseries", 3, 120, exercises=[ex("De pica a lean planche", reps="5"), ex("Lean Planche", 10)]),
    blk("biseries", 3, 180, exercises=[ex("Flexiones lean planche", reps="8-10"), ex("Lean Planche", 10)]),
    blk("single", 3, 180, exercises=[ex("Flexiones en pica 90°", reps="8-10")]),
    blk("single", 4, 120, exercises=[ex("Tuck planche", 15, notes="10-15s")]),
  ]),
  model("str-r2", "Straddle R2", 2, 20, [
    blk("single", 4, 180, exercises=[ex("Intentos lean con rodillas (levantando)", 15)]),
    blk("biseries", 4, 180, exercises=[ex("Flexiones lean supina explosivas", reps="7"), ex("Hold lean supina", 10)]),
    blk("biseries", 3, 180, exercises=[ex("De pica a lean planche", reps="5"), ex("Lean planche", 10)]),
    blk("single", 3, 180, exercises=[ex("Flexiones en pica 90°", reps="8-10")]),
  ]),
  model("str-r3", "Straddle R3", 3, 20, [
    blk("single", 2, 90, exercises=[ex("Lean con rodillas en suelo (levantando)", 10)]),
    blk("single", 4, 240, exercises=[ex("De pica a straddle", reps="2-4")]),
    blk("biseries", 3, 210, exercises=[ex("Flexiones tuck planche", reps="5"), ex("Hold tuck planche", 10)]),
    blk("biseries", 3, 180, exercises=[ex("Flexiones lean supina explosivas", reps="6-7"), ex("Hold lean supina", 10)]),
  ]),
  model("str-r4", "Straddle R4", 3, 20, [
    blk("superseries", 4, 210, exercises=[ex("Descenso de pica a tuck", reps="1"), ex("Press en tuck", 5, notes="3-4s"), ex("Hold tuck planche", 10)]),
    blk("biseries", 3, 210, exercises=[ex("Flexiones en tuck planche", reps="5"), ex("Hold tuck planche", 10)]),
    blk("biseries", 3, 180, exercises=[ex("Flexiones lean supinas explosivas", reps="6-7"), ex("Hold lean supina", 10)]),
    blk("single", 3, 90, exercises=[ex("Flexiones en pica abiertas", reps="15")]),
  ]),
  model("str-r5", "Straddle R5", 3, 20, [
    blk("single", 5, 240, exercises=[ex("Intentos Press a straddle planche (levantando)", reps="2")]),
    blk("superseries", 3, 210, exercises=[ex("Press desde tuck planche", reps="3-4"), ex("Negativa a tuck planche", reps="1"), ex("Hold tuck planche", 10)]),
    blk("biseries", 3, 180, exercises=[ex("Flexiones pica 90°", reps="5"), ex("Flexiones lean planche", reps="5-7")]),
    blk("biseries", 3, 120, exercises=[ex("De pica a lean planche", reps="5"), ex("Lean planche", 10)]),
  ]),
  model("str-pro1", "PRO1", 3, 20, [
    blk("single", 5, 240, exercises=[ex("Straddle Planche (intentos)", reps="max", notes="max seg")]),
    blk("single", 3, 210, exercises=[ex("De pica a straddle planche", reps="2-3")]),
    blk("biseries", 3, 240, exercises=[ex("Flexiones tuck planche", reps="5-6"), ex("Tuck planche", 10)]),
    blk("biseries", 4, 180, exercises=[ex("Flexiones lean supinas explosivas", reps="5"), ex("Lean planche supina", 10)]),
  ]),
]

straddle_program = {
  "id": "planche-straddle",
  "categoryId": "planche",
  "name": "Straddle Planche",
  "level": "intermediate",
  "description": "Straddle: intensidad 2/3, R1-R5 + PRO1.",
  "objectives": ["Ganar fuerza de straddle planche"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48-72h",
  "rules": ["Descansos largos entre series."],
  "models": straddle_models,
  "optional": True,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "planche":
        progs = [p for p in c["programs"] if p["id"] != "planche-straddle"]
        progs.append(straddle_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("straddle merged:", len(straddle_models), "models")
