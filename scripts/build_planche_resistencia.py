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

res_models = [
  # Nivel 1
  model("res-n1-pr1", "Nivel 1 - PR1", 2, 20, [
    blk("biseries", 4, 90, exercises=[ex("Frog planche asistido", reps="max", notes="max seg"), ex("Lean Planche", 10)]),
    blk("biseries", 4, 120, exercises=[ex("Flexiones en pica estándar", reps="6-8"), ex("Flexiones supinas", reps="6-8")]),
    blk("single", 4, 90, exercises=[ex("Descenso de pica a lean (3s pica / 8s lean)", reps="2")]),
    blk("biseries", 3, 90, exercises=[ex("Fondos en paralelas", reps="4-8"), ex("Flexiones normales", reps="10-15")]),
  ]),
  model("res-n1-pr2", "Nivel 1 - PR2", 2, 20, [
    blk("biseries", 3, 90, exercises=[ex("Lean planche", 10), ex("Flexiones diamante", reps="5-8")]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones en lean planche", reps="RIR1"), ex("Flexiones normales", reps="10")]),
    blk("biseries", 3, 120, exercises=[ex("Fondos con hollow (protracción ligera)", reps="3-5"), ex("Fondos normales", reps="5-10")]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones explosivas supinas en suspensión", reps="10"), ex("Lean planche supina", 10)]),
  ]),
  model("res-n1-pr3", "Nivel 1 - PR3", 2, 20, [
    blk("biseries", 3, 120, exercises=[ex("Hollow en barra supino (aguante)", 5), ex("Fondos en barra supino", reps="8-10")]),
    blk("biseries", 4, 120, exercises=[ex("De pica a tuck planche (descensos)", reps="2-3"), ex("Lean planche", 15)]),
    blk("biseries", 3, 90, exercises=[ex("Flexiones en pica (pies elevados)", reps="RIR1"), ex("Plank hold", 20)]),
    blk("single", 3, 120, exercises=[ex("Flexiones diamante", reps="RIR1")]),
  ]),
  # Nivel 2
  model("res-n2-pr1", "Nivel 2 - PR1", 2, 20, [
    blk("biseries", 4, 90, exercises=[ex("Tuck planche (max seg)", reps="max", notes="max seg"), ex("Lean Planche", 15)]),
    blk("single", 3, 150, exercises=[ex("De L a tuck planche (dead stop 2s)", reps="RIR1")]),
    blk("superseries", 3, 120, exercises=[ex("Flexiones en pica", reps="10"), ex("Flexiones lean planche", reps="3-6"), ex("Lean planche", 10)]),
    blk("single", 3, 90, exercises=[ex("Fondos en paralela (explosivos)", reps="10-15")]),
  ]),
  model("res-n2-pr2", "Nivel 2 - PR2", 2, 20, [
    blk("superseries", 4, 150, exercises=[ex("Flexiones lean planche", reps="4-7"), ex("Intento de tuck planche", reps="1"), ex("Lean planche", 10)]),
    blk("single", 3, 90, exercises=[ex("De pica a lean planche (5s/10s)", reps="2")]),
    blk("biseries", 3, 120, exercises=[ex("Hollow en barra (10s)", 10), ex("Fondos supinos", reps="10")]),
    blk("biseries", 3, 90, exercises=[ex("Flexiones en pica", reps="10-15"), ex("Flexiones en diamante", reps="8-10")]),
  ]),
  model("res-n2-pr3", "Nivel 2 - PR3", 3, 20, [
    blk("biseries", 4, 150, exercises=[ex("Flexiones de pino asistido (pared)", reps="4-8"), ex("Lean planche", 10)]),
    blk("superseries", 3, 150, exercises=[ex("Flexiones en pica", reps="6-10"), ex("Flexiones lean planche", reps="3"), ex("Lean planche", 10)]),
    blk("single", 3, 120, exercises=[ex("Fondos en paralela (explosivos)", reps="RIR1")]),
    blk("single", 4, 105, exercises=[ex("Flexiones normales", reps="15-20")]),
  ]),
  # Nivel 3
  model("res-n3-pr1", "Nivel 3 - PR1", 3, 20, [
    blk("superseries", 4, 180, exercises=[ex("Straddle planche (banda)", reps="RIR1", notes="seg"), ex("Flexiones lean planche", reps="RIR1"), ex("Lean planche", 5)]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones en tuck planche", reps="RIR1"), ex("Lean planche", 10)]),
    blk("biseries", 3, 150, exercises=[ex("Flexiones pino en pared", reps="RIR1"), ex("Flexiones en pica (pies en altura)", reps="6-10")]),
    blk("single", 3, 90, exercises=[ex("Descenso de pica a lean (5s/10s)", reps="3")]),
  ]),
  model("res-n3-pr2", "Nivel 3 - PR2", 3, 20, [
    blk("biseries", 3, 120, exercises=[ex("Fondos en paralelas (explosivos)", reps="15-20"), ex("Tuck planche", reps="RIR1", notes="seg")]),
    blk("biseries", 3, 120, exercises=[ex("Hold en barra supino (tuck advanced)", 10, notes="8-10s"), ex("Fondos supinos", reps="10")]),
    blk("superseries", 3, 150, exercises=[ex("Flexiones pino en pared", reps="8-10"), ex("Flexiones lean planche", reps="4-6"), ex("Lean planche", 5)]),
    blk("single", 4, 90, exercises=[ex("Flexiones diamante", reps="15")]),
  ]),
  model("res-n3-pr3", "Nivel 3 - PR3", 3, 20, [
    blk("single", 4, 180, exercises=[ex("De pica a straddle planche (2s dead stop)", reps="RIR1")]),
    blk("biseries", 3, 150, exercises=[ex("Fondos en barra supino (explosivos)", reps="RIR1"), ex("Hold en barra supino (tuck advanced)", reps="RIR1", notes="seg")]),
    blk("superseries", 3, 150, exercises=[ex("Flexiones pica 90°", reps="6-10"), ex("Flexiones lean planche", reps="3-6"), ex("Lean planche", 5)]),
    blk("single", 3, 90, exercises=[ex("Descenso de pica a lean (5s/10s)", reps="3")]),
  ]),
]

res_program = {
  "id": "planche-resistencia",
  "categoryId": "planche",
  "name": "Planche (resistencia)",
  "level": "intermediate",
  "description": "Resistencia: 3 niveles (Nivel 1/2/3) con PR1-PR3.",
  "objectives": ["Ganar resistencia de planche"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48h",
  "rules": ["Realizar al final de rutinas de fuerza.", "Alternar con fuerza (48h)."],
  "models": res_models,
  "optional": True,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "planche":
        progs = [p for p in c["programs"] if p["id"] != "planche-resistencia"]
        progs.append(res_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("resistencia merged:", len(res_models), "models")
