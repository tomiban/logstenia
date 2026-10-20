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
  model("fz-adv-b1", "Modelo B1", 2, 20, [
    blk("single", 4, 120, exercises=[ex("Dominadas a la cadera (explosivas, banda)", reps="4-8")]),
    blk("biseries", 4, 120, exercises=[ex("Flexiones parciales pino en pared", reps="6-10"), ex("Flexiones normales (codos pegados)", reps="10-15")]),
    blk("superseries", 2, 120, exercises=[ex("Curl bíceps supino (iso 1-2s)", reps="3-5"), ex("Curl bíceps prono (iso 1-2s)", reps="3-5"), ex("Dominadas pronas", reps="8-10")]),
    blk("biseries", 3, 90, exercises=[ex("Leg raises completas (iso 2s arriba)", reps="6-10"), ex("Lean planche supino", 15)]),
  ]),
  model("fz-adv-b2", "Modelo B2", 2, 20, [
    blk("single", 5, 120, exercises=[ex("Dominadas pronas (normales)", reps="10-15")]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones en pica 90°", reps="4-8"), ex("Lean planche", 15)]),
    blk("biseries", 3, 120, exercises=[ex("Leg raises completas (1 mano asistidas)", 10, notes="x brazo"), ex("Leg raises normales (hasta arriba)", 20)]),
    blk("superseries", 2, 105, exercises=[ex("Flexiones en diamante", reps="8-10"), ex("Flexiones normales (manos altura hombros)", reps="8-10"), ex("Flexiones abiertas", reps="8-10")]),
  ]),
  model("fz-adv-b3", "Modelo B3", 2, 20, [
    blk("single", 4, 150, exercises=[ex("Flexiones pino en pared (buscando profundidad)", reps="4-8")]),
    blk("single", 3, 120, exercises=[ex("De pica a lean + flexión (buscando inclinación)", reps="4-6")]),
    blk("single", 2, 120, exercises=[ex("Flexiones supinas (explosivas, iso abajo)", reps="8-12")]),
    blk("biseries", 2, 60, exercises=[ex("Reverse planche lean", 10), ex("Flexiones normales", reps="10")]),
  ]),
  model("fz-adv-b4", "Modelo B4", 2, 20, [
    blk("single", 4, 120, exercises=[ex("Fondos supinos en barra (explosivos)", reps="8-15")]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones suelo supina (explosivas, iso abajo)", reps="8-10"), ex("Lean planche supino", 10)]),
    blk("single", 3, 120, exercises=[ex("Dominadas explosivas (por debajo del pecho)", reps="4-8")]),
    blk("biseries", 3, 105, exercises=[ex("Intentos de L a V en paralelas", reps="4-8"), ex("Leg raises normales", reps="4-8")]),
  ]),
  model("fz-adv-b5", "Modelo B5", 3, 20, [
    blk("single", 3, 120, exercises=[ex("Dominadas a la cadera (explosivas, banda)", reps="4-8")]),
    blk("single", 3, 120, exercises=[ex("Dominadas al pecho (explosivas)", reps="6-10")]),
    blk("biseries", 3, 120, exercises=[ex("Fondos supinos en barra (explosivos)", reps="8-10"), ex("Fondos normales", reps="8-10")]),
    blk("biseries", 3, 90, exercises=[ex("Lanzadas de L a leg raises en barra alta", 20), ex("Leg raises completas", reps="5")]),
  ]),
  model("fz-adv-b6", "Modelo B6", 3, 20, [
    blk("single", 3, 120, exercises=[ex("Dominadas bajo del pecho (explosivas)", reps="4-8")]),
    blk("single", 3, 120, exercises=[ex("Dominadas arqueras (reps x brazo)", reps="2-4")]),
    blk("superseries", 2, 120, exercises=[ex("Curl bíceps en supino", reps="4-6"), ex("Dominadas prona cerrada", reps="5-10"), ex("Dominadas prona normal", reps="5-10")]),
    blk("biseries", 3, 90, exercises=[ex("Hefesto asistido (pies en suelo)", reps="8-10"), ex("Lean planche supina", 10)]),
  ]),
  model("fz-adv-b7", "Modelo B7", 3, 20, [
    blk("biseries", 3, 120, exercises=[ex("Flexiones pino en pared", reps="4-8"), ex("Isométrico pino en pared", 15, notes="10-15s")]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones en pica 90° (pies elevados)", reps="4-8"), ex("Lean planche (pies elevados)", 10)]),
    blk("biseries", 3, 90, exercises=[ex("Flexiones explosivas (iso abajo)", reps="8-10"), ex("Flexiones normales (codos pegados)", reps="8-10")]),
    blk("biseries", 2, 120, exercises=[ex("De knee raises a leg raises (subir max)", reps="4-6"), ex("Plank en suelo", 20)]),
  ]),
  model("fz-adv-b8", "Modelo B8", 3, 20, [
    blk("biseries", 4, 120, exercises=[ex("Dominadas arqueras (reps x brazo)", reps="2-3"), ex("Dominadas pronas explosivas (pasando barbilla)", reps="4-6")]),
    blk("biseries", 3, 120, exercises=[ex("Leg raises completas (1 mano sin asistencia)", reps="3-5", notes="x brazo"), ex("Leg raises normales", reps="4-8")]),
    blk("biseries", 3, 105, exercises=[ex("Fondos supino explosivo (parada abajo 2s)", reps="6-10"), ex("Flexiones supinas en suelo", reps="10-12")]),
    blk("biseries", 2, 90, exercises=[ex("De lean a pica y volver", reps="5"), ex("Lean planche (buscando inclinación)", 10)]),
  ]),
]

fuerza_program = {
  "id": "fuerza-avanzados",
  "categoryId": "fuerza",
  "name": "Fuerza Avanzada",
  "level": "advanced",
  "description": "8 modelos B1-B8 (avanzados).",
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
        progs = [p for p in c["programs"] if p["id"] != "fuerza-avanzados"]
        progs.append(fuerza_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("fuerza avanzados merged:", len(fuerza_models), "models")
