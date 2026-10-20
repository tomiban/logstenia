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

full_models = [
  model("full-r1", "Full Front R1", 2, 20, [
    blk("single", 2, 180, exercises=[ex("Intentos Front Lever full (banda)", reps="max", notes="max seg")]),
    blk("single", 4, 240, exercises=[ex("Presses tuck adv + negativa en full (banda)", reps="2-6")]),
    blk("single", 5, 210, exercises=[ex("Pull up tuck adv explosiva (banda en cadera)", reps="5-10")]),
    blk("biseries", 3, 210, exercises=[ex("De L sit a tuck adv FL", reps="4"), ex("Hold en tuck/adv FL", reps="max", notes="max seg")]),
    blk("single", 3, 150, exercises=[ex("Dominadas de bíceps", reps="10")]),
  ]),
  model("full-r2", "Full Front R2", 2, 20, [
    blk("single", 3, 210, exercises=[ex("Presses en full Fl desde pica (neg+pos, banda)", reps="3-5")]),
    blk("single", 4, 210, exercises=[ex("De tuck Fl a full Fl (banda en pies)", reps="2-4")]),
    blk("single", 4, 210, exercises=[ex("Tuck adv pull ups explosivas", reps="4-8")]),
    blk("single", 3, 210, exercises=[ex("De L a tuck adv + press a pica en full Fl", reps="2-4")]),
    blk("single", 4, 150, exercises=[ex("Dominada explosiva supina (hasta cadera)", reps="5-8")]),
  ]),
  model("full-r3", "Full Front R3", 2, 20, [
    blk("single", 2, 90, exercises=[ex("Hold Tuck adv. Fl", 10)]),
    blk("single", 4, 180, exercises=[ex("Press a semi full + negativa controlada", reps="2-4")]),
    blk("single", 4, 180, exercises=[ex("Hold Front Lever (banda)", reps="max", notes="max seg")]),
    blk("biseries", 4, 180, exercises=[ex("Pull ups tuck adv. explosivas (banda)", reps="6-10"), ex("Hold en tuck adv. Fl", 3, notes="1-3s")]),
    blk("single", 3, 180, exercises=[ex("Press de tuck adv. a full + negativa", reps="2-4")]),
  ]),
  model("full-r4", "Full Front R4", 3, 20, [
    blk("single", 2, 90, exercises=[ex("Intentos Tuck adv. Fl", 10, notes="max seg")]),
    blk("single", 2, 240, exercises=[ex("Front lever en full + press (banda)", reps="2-3")]),
    blk("biseries", 4, 240, exercises=[ex("Pull ups Front lever full (banda)", reps="3-5"), ex("Hold en Front lever full (banda)", 3, notes="1-3s")]),
    blk("single", 3, 180, exercises=[ex("Press de tuck adv. a full + negativa máxima", reps="2-3")]),
    blk("biseries", 4, 210, exercises=[ex("Pull ups en tuck adv Fl explosivas", reps="6-8"), ex("Hold en tuck adv. Fl", 10, notes="6-10s")]),
  ]),
  model("full-r5", "Full Front R5", 3, 20, [
    blk("single", 4, 210, exercises=[ex("Intentos Front Lever full (banda)", reps="max", notes="max seg")]),
    blk("biseries", 4, 240, exercises=[ex("Touch to bar tuck adv Fl", 10, notes="5-10s"), ex("Pull ups en tuck adv. Fl", reps="3-5")]),
    blk("single", 3, 210, exercises=[ex("Press de tuck adv. a full + negativa máxima", reps="2-3")]),
    blk("single", 4, 120, exercises=[ex("Dominadas pronas explosivas (hasta debajo del pecho)", reps="5-8")]),
    blk("single", 3, 90, exercises=[ex("Dominadas estándar", reps="12")]),
  ]),
]

full_program = {
  "id": "front-full",
  "categoryId": "frontlever",
  "name": "Full Front Lever",
  "level": "advanced",
  "description": "Full Front Lever: intensidad 2/3, R1-R5.",
  "objectives": ["Desarrollo de fuerza específica", "Potenciar propiocepción"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48h",
  "rules": ["Realizar al menos 2 veces por semana.", "Respetar tiempos de descanso."],
  "models": full_models,
  "optional": True,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "frontlever":
        progs = [p for p in c["programs"] if p["id"] != "front-full"]
        progs.append(full_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("full front merged:", len(full_models), "models")
