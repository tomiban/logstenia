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

backlever_models = [
  model("bl-n1-i1", "Nivel 1 - Intensidad 1", 1, 20, [
    blk("single", 3, 120, exercises=[ex("Flexiones de hombro (supinación + rotación externa, banda)", reps="10", cadence="3:1")]),
    blk("single", 3, 120, exercises=[ex("Simulación curl Hefesto (banda)", reps="10", cadence="3:1")]),
    blk("single", 1, 120, exercises=[ex("Negativa Hefesto asistido (manos a cadera 45°)", reps="5-7", notes="4-5s bajada")]),
    blk("single", 3, 120, exercises=[ex("Isométrico Hefesto touch (tuck avanzado/L invertida)", reps="3", notes="SIR")]),
  ]),
  model("bl-n1-i2", "Nivel 1 - Intensidad 2", 2, 20, [
    blk("single", 3, 120, exercises=[ex("Hefesto asistido (barra baja, manos a cadera 45°)", reps="10", cadence="3:2")]),
    blk("single", 3, 120, exercises=[ex("Inclinaciones a back lever (Hefesto touch)", reps="5-7", cadence="2:2")]),
    blk("single", 3, 120, exercises=[ex("Isométrico Hefesto touch (tuck/L invertida)", reps="2", notes="SIR")]),
    blk("single", 1, 120, exercises=[ex("Negativa Hefesto a back lever (full/straddle)", reps="5", notes="4-5s bajada")]),
  ]),
  model("bl-n1-i3", "Nivel 1 - Intensidad 3", 3, 20, [
    blk("single", 1, 120, exercises=[ex("Hefestos (max reps hasta fallo técnico)", reps="max")]),
    blk("single", 5, 120, exercises=[ex("Negativa de Hefesto (45°)", reps="5", notes="4-5s bajada")]),
    blk("single", 1, 120, exercises=[ex("Negativa desde Hefesto touch (tuck/L invertida)", reps="5", notes="4-5s bajada")]),
    blk("single", 3, 120, exercises=[ex("Isométrico Hefesto touch (progresión cómoda de BL)", reps="1", notes="SIR")]),
  ]),
  model("bl-n2-i1", "Nivel 2 - Intensidad 1", 1, 20, [
    blk("single", 3, 120, exercises=[ex("Flexiones de hombro (supinación + rotación externa, banda)", reps="10", cadence="3:1")]),
    blk("single", 3, 120, exercises=[ex("Simulación curl Hefesto (banda)", reps="10", cadence="3:1")]),
    blk("single", 1, 120, exercises=[ex("Negativa desde Hefesto touch (tuck/L invertida)", reps="3", notes="4-5s bajada")]),
    blk("single", 3, 120, exercises=[ex("Isométrico Hefesto touch (progresión cómoda de BL)", reps="3", notes="SIR")]),
  ]),
  model("bl-n2-i2", "Nivel 2 - Intensidad 2", 2, 20, [
    blk("single", 1, 120, exercises=[ex("Hefesto (45° o mayor inclinación)", reps="RIR1", notes="1 RIR")]),
    blk("single", 4, 120, exercises=[ex("Isométrico Hefesto touch (full/half lay BL)", reps="2", notes="SIR")]),
    blk("single", 3, 120, exercises=[ex("Hefesto hasta la cadera (asistido, pies a nivel de barra)", reps="8", cadence="3:2")]),
  ]),
  model("bl-n2-i3", "Nivel 2 - Intensidad 3", 3, 20, [
    blk("single", 1, 120, exercises=[ex("Back Lever Hefesto parcial (intentos hasta cerca del fallo)", reps="max")]),
    blk("single", 1, 120, exercises=[ex("Hefesto (45° o mayor inclinación)", reps="RIR1", notes="1 RIR")]),
    blk("single", 1, 120, exercises=[ex("Negativa Hefesto touch (full BL)", reps="5", notes="4-5s bajada")]),
    blk("single", 3, 120, exercises=[ex("Hefesto hasta la cadera (un pie asistido)", reps="7-8", cadence="3:1")]),
  ]),
]

backlever_program = {
  "id": "backlever-hefesto",
  "categoryId": "hefesto",
  "name": "Hefesto Avanzado",
  "level": "advanced",
  "description": "Master: niveles 1 y 2 × 3 intensidades.",
  "objectives": ["Touch de back lever hefesto ≥5s", "Primer back lever hefesto", "Adaptar carga progresiva"],
  "goals": [],
  "frequency": "2-3×/sem",
  "restBetweenSessions": "2-3 días",
  "rules": ["Descanso según esfuerzo (1-5 min).", "Cadencia 3:1."],
  "models": backlever_models,
}

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "hefesto":
        progs = [p for p in c["programs"] if p["id"] != "backlever-hefesto"]
        progs.append(backlever_program)
        c["programs"] = progs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("backlever merged:", len(backlever_models), "models")
