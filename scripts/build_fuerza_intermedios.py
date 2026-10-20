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
  model("fz-int-b1", "Modelo B1", 2, 20, [
    blk("single", 5, 120, exercises=[ex("Dominadas pronas (agarre estándar)", reps="8-10")]),
    blk("single", 3, 120, exercises=[ex("Flexiones en pica (pies en altura)", reps="8-10")]),
    blk("biseries", 3, 120, exercises=[ex("Leg raises parciales (1 mano asistidas)", 10), ex("Leg raises normales (máx altura)", 20)]),
    blk("biseries", 3, 120, exercises=[ex("Fondos en barra", reps="10"), ex("Australian pull ups explosivas", reps="10-15")]),
  ]),
  model("fz-int-b2", "Modelo B2", 2, 20, [
    blk("single", 4, 150, exercises=[ex("Dominadas explosivas (bajo del pecho, banda)", reps="5-8")]),
    blk("single", 3, 120, exercises=[ex("Dominadas explosivas (pasando barbilla)", reps="6-8")]),
    blk("single", 3, 120, exercises=[ex("Fondos en paralelas (explosivos)", reps="6-8")]),
    blk("single", 3, 90, exercises=[ex("Flexiones en suelo (explosivas, iso abajo)", reps="6-10")]),
  ]),
  model("fz-int-b3", "Modelo B3", 2, 20, [
    blk("single", 3, 150, exercises=[ex("Dominadas arqueras (banda)", reps="4-6")]),
    blk("single", 3, 120, exercises=[ex("Curl de bíceps en barra (iso 2s arriba)", reps="6-8")]),
    blk("single", 3, 120, exercises=[ex("Dominadas explosivas (pasando barbilla)", reps="6-8")]),
    blk("biseries", 3, 150, exercises=[ex("Flexiones lean planche", reps="4-6"), ex("Fondos en paralelas (explosivos)", reps="6-10")]),
  ]),
  model("fz-int-b4", "Modelo B4", 2, 20, [
    blk("single", 3, 120, exercises=[ex("Dominadas explosivas (pasando barbilla)", reps="6-8")]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones en suelo (iso abajo)", reps="8"), ex("Flexiones en pica en suelo", reps="5-8")]),
    blk("superseries", 2, 120, exercises=[ex("Dominadas pronas cerradas", reps="2"), ex("Dominadas supinas cerradas", reps="2"), ex("Dominadas pronas normales", reps="2"), ex("Dominadas supinas normales", reps="2"), ex("Fondos en barra", reps="10-15"), ex("Leg raises completas", reps="6-8"), ex("Knee raises explosivas", reps="10")]),
    blk("biseries", 2, 90, exercises=[ex("Lean planche", 15), ex("Flexiones normales", reps="10-15")]),
  ]),
  model("fz-int-b5", "Modelo B5", 3, 20, [
    blk("single", 4, 120, exercises=[ex("Fondos en paralelas (explosivos)", reps="8-15")]),
    blk("single", 3, 120, exercises=[ex("Flexiones en suelo (explosivas, iso abajo)", reps="8-12")]),
    blk("single", 4, 150, exercises=[ex("Dominadas explosivas supinas (pasando barbilla)", reps="6-10")]),
    blk("superseries", 2, 90, exercises=[ex("L sit en barra (elevaciones cortas)", 10), ex("Knee raises explosivas alternando", 20), ex("Australian pull ups explosivas", reps="10-12")]),
  ]),
  model("fz-int-b6", "Modelo B6", 3, 20, [
    blk("single", 4, 120, exercises=[ex("Flexiones lean planche (buscando inclinación)", reps="6-8")]),
    blk("biseries", 3, 150, exercises=[ex("Flexiones en pica (pies elevados)", reps="6-10"), ex("Flexiones en suelo (explosivas, iso abajo)", reps="5-8")]),
    blk("biseries", 3, 120, exercises=[ex("Flexiones diamante", reps="6-10"), ex("Lean planche supina", 10)]),
    blk("biseries", 3, 90, exercises=[ex("Leg raises en paralelas (con parada)", reps="6-10"), ex("Knee raises en paralelas (explosivos)", reps="10")]),
  ]),
  model("fz-int-b7", "Modelo B7", 3, 20, [
    blk("single", 4, 120, exercises=[ex("Aguantes pino en pared", 20, notes="15-30s")]),
    blk("single", 3, 120, exercises=[ex("Flexiones en pica (elevados)", reps="6-10")]),
    blk("single", 3, 90, exercises=[ex("Flexiones en suelo (explosivas, iso abajo)", reps="6-10")]),
    blk("biseries", 3, 90, exercises=[ex("Leg raises en paralelas (parada 2s)", reps="6-10"), ex("Knee raises en paralelas (explosivos)", reps="10")]),
  ]),
  model("fz-int-b8", "Modelo B8", 3, 20, [
    blk("single", 3, 150, exercises=[ex("Dominadas explosivas (hasta bajo pecho, banda)", reps="5-8")]),
    blk("biseries", 3, 120, exercises=[ex("Leg raises parciales (1 mano asistidas)", 10, notes="x brazo"), ex("Leg raises normales (máx altura)", 20)]),
    blk("single", 3, 120, exercises=[ex("Dominadas explosivas (pasando barbilla)", reps="6-8")]),
    blk("superseries", 3, 120, exercises=[ex("Lean planche supina", 10), ex("Flexiones supina en suelo", reps="6-10"), ex("Lean planche", 10)]),
  ]),
]

fuerza_program = {
  "id": "fuerza-intermedios",
  "categoryId": "fuerza",
  "name": "Fuerza Intermedia",
  "level": "intermediate",
  "description": "8 modelos B1-B8 (intermedios).",
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
        progs = [p for p in c["programs"] if p["id"] != "fuerza-intermedios"]
        progs.append(fuerza_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("fuerza intermedios merged:", len(fuerza_models), "models")
