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
  model("full-r1", "Full Planche R1", 2, 20, [
    blk("single", 4, 180, exercises=[ex("De tuck a full y volver", 20, notes="15-20s")]),
    blk("biseries", 3, 240, exercises=[ex("Flexiones tuck adv explosivas", reps="5-7"), ex("Hold tuck advanced", 10)]),
    blk("biseries", 4, 180, exercises=[ex("Flex supina método de choque (2s iso)", reps="5-8"), ex("Flexiones en pica 90°", reps="5")]),
    blk("biseries", 3, 120, exercises=[ex("Fondos en paralelas", reps="10-12"), ex("Lean planche", 15)]),
  ]),
  model("full-r2", "Full Planche R2", 2, 20, [
    blk("single", 4, 210, exercises=[ex("Max Hold full planche (banda fina)", reps="max", notes="max seg")]),
    blk("single", 3, 180, exercises=[ex("Lean rodillas en suelo (tirando 1 pierna atrás)", 20, notes="15-20s")]),
    blk("single", 3, 180, exercises=[ex("De pica a tuck advanced + hold 3s", reps="4-6")]),
    blk("single", 4, 180, exercises=[ex("Flexiones en pino", reps="8-14")]),
  ]),
  model("full-r3", "Full Planche R3", 3, 20, [
    blk("single", 4, 180, exercises=[ex("Lean rodillas en suelo + tirada a full hold 1 pierna", 20, notes="15-20s")]),
    blk("single", 3, 240, exercises=[ex("Bajada pino a semi full + hold 3-4s", reps="2-3")]),
    blk("superseries", 3, 210, exercises=[ex("Flex supina método de choque (2s iso)", reps="2-3"), ex("Flex lean supina", reps="5"), ex("Lean planche supina", 10)]),
    blk("single", 4, 210, exercises=[ex("Flexiones en pino", reps="6-10")]),
  ]),
  model("full-r4", "Full Planche R4", 3, 20, [
    blk("single", 4, 210, exercises=[ex("Press a full planche (banda en cadera)", reps="3-6")]),
    blk("biseries", 3, 180, exercises=[ex("Flexiones lean planche", reps="10"), ex("Lean planche", 15)]),
    blk("biseries", 3, 210, exercises=[ex("Fondos en barra supino (método de choque)", reps="5-7"), ex("Hold posición arriba", 10)]),
    blk("single", 3, 180, exercises=[ex("Flexiones en pino", reps="6-10")]),
  ]),
  model("full-r5", "Full Planche R5", 3, 20, [
    blk("single", 5, 240, exercises=[ex("Negativas de pino a full planche + máx hold", reps="1")]),
    blk("single", 3, 240, exercises=[ex("De tuck a full planche y volver", reps="3-4")]),
    blk("superseries", 3, 210, exercises=[ex("Flex supina método de choque (5 reps)", reps="5"), ex("Flex en lean supina", reps="5"), ex("Lean planche supina", 10)]),
    blk("biseries", 3, 120, exercises=[ex("Fondos en paralelas", reps="10-12"), ex("Lean planche", 15)]),
  ]),
  model("full-pro1", "PRO1", 3, 20, [
    blk("single", 4, 180, exercises=[ex("Negativas de pino a full planche + máx hold", reps="1")]),
    blk("single", 3, 240, exercises=[ex("De tuck a full planche y volver", reps="3-4")]),
    blk("biseries", 3, 240, exercises=[ex("Flexiones tuck planche", reps="5-6"), ex("Tuck planche", 10)]),
    blk("biseries", 4, 180, exercises=[ex("Flexiones lean planche explosivas supinas", reps="5"), ex("Lean planche supina", 10)]),
  ]),
]

full_program = {
  "id": "planche-full",
  "categoryId": "planche",
  "name": "Full Planche",
  "level": "advanced",
  "description": "Full Planche: intensidad 2/3, R1-R5 + PRO1 (con equipamiento).",
  "objectives": ["Ganar fuerza explosiva", "Full planche"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "48-72h",
  "rules": ["Antes de cada rutina: 2-3 intentos de full planche sin fatigar."],
  "models": full_models,
  "optional": True,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "planche":
        progs = [p for p in c["programs"] if p["id"] != "planche-full"]
        progs.append(full_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("full merged:", len(full_models), "models")
