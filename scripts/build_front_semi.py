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

semi_models = [
  model("semi-r1", "Semi Front R1", 2, 20, [
    blk("single", 2, 90, exercises=[ex("Hold Tuck Front Lever", reps="max", notes="max seg")]),
    blk("single", 4, 120, exercises=[ex("Hold Tuck Adv. FL (banda en cadera)", reps="max", notes="max")]),
    blk("single", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL (banda en cadera)", reps="2-5")]),
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("single", 3, 90, exercises=[ex("Australia Pull Ups explosivas (supino)", reps="15")]),
  ]),
  model("semi-r2", "Semi Front R2", 2, 20, [
    blk("biseries", 4, 180, exercises=[ex("De L sit a tuck adv FL", reps="2-4"), ex("Hold en tuck adv FL", 10, notes="5-10s")]),
    blk("biseries", 4, 180, exercises=[ex("Presses en tuck FL", reps="2-3"), ex("Hold en tuck front lever", 3, notes="1-3s")]),
    blk("single", 4, 120, exercises=[ex("Dominadas supinas explosivas (hasta debajo del pecho)", reps="4-6")]),
    blk("biseries", 3, 150, exercises=[ex("Dominadas pronas cerradas", reps="6"), ex("Leg Raises", 8)]),
  ]),
  model("semi-r3", "Semi Front R3", 3, 20, [
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL (banda en cadera)", reps="2-5")]),
    blk("single", 4, 120, exercises=[ex("Dominadas supinas explosivas (hasta debajo del pecho)", reps="4-6")]),
    blk("single", 3, 90, exercises=[ex("Leg Raises (barra alta, tocando arriba)", reps="6-10")]),
    blk("single", 3, 90, exercises=[ex("Dominadas estándar", reps="10")]),
  ]),
  model("semi-r4", "Semi Front R4", 3, 20, [
    blk("biseries", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL", reps="3-5"), ex("Hold en Tuck Adv. FL", 10)]),
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("biseries", 3, 150, exercises=[ex("De L sit a tuck adv FL", reps="2-3"), ex("Hold en tuck adv FL", 10, notes="5-10s")]),
    blk("single", 4, 120, exercises=[ex("Dominadas prona explosivas (hasta debajo del pecho)", reps="3-6")]),
    blk("single", 3, 90, exercises=[ex("Dominadas estándar", reps="10")]),
  ]),
]

semi_program = {
  "id": "front-semi",
  "categoryId": "frontlever",
  "name": "Semi Front Lever",
  "level": "intermediate",
  "description": "Semi Front Lever: intensidad 2/3, R1-R4.",
  "objectives": ["Desarrollo de fuerza específica", "Potenciar propiocepción"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48h",
  "rules": ["Realizar al menos 2 veces por semana.", "Respetar tiempos de descanso."],
  "models": semi_models,
  "optional": True,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "frontlever":
        progs = [p for p in c["programs"] if p["id"] != "front-semi"]
        progs.append(semi_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("semi merged:", len(semi_models), "models")
