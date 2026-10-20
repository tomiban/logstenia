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

fl_models = [
  model("fl-r1-i2", "Modelo R1 - Intensidad 2", 2, 20, [
    blk("single", 2, 90, exercises=[ex("Hold Tuck Front Lever", reps="max", notes="max seg")]),
    blk("single", 4, 120, exercises=[ex("Hold Tuck Adv. FL (banda en cadera)", reps="max", notes="4 series")]),
    blk("single", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL (banda en cadera)", reps="2-5")]),
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("single", 3, 90, exercises=[ex("Australia Pull Ups explosivas (supino)", reps="15")]),
  ]),
  model("fl-r2-i2", "Modelo R2 - Intensidad 2", 2, 20, [
    blk("biseries", 4, 180, exercises=[ex("De L sit a tuck adv FL", reps="2-4"), ex("Hold en tuck adv FL", 10, notes="5-10s")]),
    blk("biseries", 4, 180, exercises=[ex("Presses en tuck FL", reps="2-3"), ex("Hold en tuck front lever", 3, notes="1-3s")]),
    blk("single", 4, 120, exercises=[ex("Dominadas supinas explosivas (hasta debajo del pecho)", reps="4-6")]),
    blk("biseries", 3, 150, exercises=[ex("Dominadas pronas cerradas", reps="6"), ex("Leg Raises", 8)]),
  ]),
  model("fl-r3-i2", "Modelo R3 - Intensidad 2", 2, 20, [
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL (banda en cadera)", reps="2-5")]),
    blk("single", 4, 120, exercises=[ex("Dominadas supinas explosivas (hasta debajo del pecho)", reps="4-6")]),
    blk("single", 3, 90, exercises=[ex("Leg Raises (barra alta, tocando arriba)", reps="6-10")]),
    blk("single", 3, 90, exercises=[ex("Dominadas estándar", reps="10")]),
  ]),
  model("fl-r4-i2", "Modelo R4 - Intensidad 2", 2, 20, [
    blk("biseries", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL", reps="3-5"), ex("Hold en Tuck Adv. FL", 10)]),
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("biseries", 3, 150, exercises=[ex("De L sit a tuck adv FL", reps="2-3"), ex("Hold en tuck adv FL", 10, notes="5-10s")]),
    blk("single", 4, 120, exercises=[ex("Dominadas prona explosivas (hasta debajo del pecho)", reps="3-6")]),
    blk("single", 3, 90, exercises=[ex("Dominadas estándar", reps="10")]),
  ]),
  model("fl-r1-i3", "Modelo R1 - Intensidad 3", 3, 20, [
    blk("single", 2, 90, exercises=[ex("Hold Tuck Front Lever", reps="max", notes="max seg")]),
    blk("single", 4, 120, exercises=[ex("Hold Tuck Adv. FL (banda en cadera)", reps="max", notes="4 series")]),
    blk("single", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL (banda en cadera)", reps="2-5")]),
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("single", 3, 90, exercises=[ex("Australia Pull Ups explosivas (supino)", reps="15")]),
  ]),
  model("fl-r2-i3", "Modelo R2 - Intensidad 3", 3, 20, [
    blk("biseries", 4, 180, exercises=[ex("De L sit a tuck adv FL", reps="2-4"), ex("Hold en tuck adv FL", 10, notes="5-10s")]),
    blk("biseries", 4, 180, exercises=[ex("Presses en tuck FL", reps="2-3"), ex("Hold en tuck front lever", 3, notes="1-3s")]),
    blk("single", 4, 120, exercises=[ex("Dominadas supinas explosivas (hasta debajo del pecho)", reps="4-6")]),
    blk("biseries", 3, 150, exercises=[ex("Dominadas pronas cerradas", reps="6"), ex("Leg Raises", 8)]),
  ]),
  model("fl-r3-i3", "Modelo R3 - Intensidad 3", 3, 20, [
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL (banda en cadera)", reps="2-5")]),
    blk("single", 4, 120, exercises=[ex("Dominadas supinas explosivas (hasta debajo del pecho)", reps="4-6")]),
    blk("single", 3, 90, exercises=[ex("Leg Raises (barra alta, tocando arriba)", reps="6-10")]),
    blk("single", 3, 90, exercises=[ex("Dominadas estándar", reps="10")]),
  ]),
  model("fl-r4-i3", "Modelo R4 - Intensidad 3", 3, 20, [
    blk("biseries", 4, 180, exercises=[ex("Pull ups Tuck Adv. FL", reps="3-5"), ex("Hold en Tuck Adv. FL", 10)]),
    blk("single", 3, 120, exercises=[ex("De Pica a escuadra (solo negativas)", reps="3-5")]),
    blk("biseries", 3, 150, exercises=[ex("De L sit a tuck adv FL", reps="2-3"), ex("Hold en tuck adv FL", 10, notes="5-10s")]),
    blk("single", 4, 120, exercises=[ex("Dominadas prona explosivas (hasta debajo del pecho)", reps="3-6")]),
    blk("single", 3, 90, exercises=[ex("Dominadas estándar", reps="10")]),
  ]),
]

frontlever_program = {
  "id": "frontlever",
  "categoryId": "frontlever",
  "name": "Front Lever",
  "level": "intermediate",
  "description": "Intermedios y avanzados: intensidad 2 y 3 (R1-R4).",
  "objectives": ["Desarrollo de fuerza específica", "Potenciar propiocepción", "Aguantar cada progresión el tiempo indicado"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48h",
  "rules": ["Realizar al menos 2 veces por semana.", "Respetar tiempos de descanso."],
  "models": fl_models,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "frontlever":
        c["programs"] = [frontlever_program]

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("frontlever merged:", len(fl_models), "models")
