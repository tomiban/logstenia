import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data", "plans.json")

def ex(name, timeSec=None, reps=None, cadence=None, notes=None, tags=None):
    e = {"name": name}
    if timeSec is not None: e["timeSec"] = timeSec
    if reps is not None: e["reps"] = reps
    if cadence: e["cadence"] = cadence
    if notes: e["notes"] = notes
    if tags: e["tags"] = tags
    return e

def blk(type_, sets, restSets, restEx=None, exercises=None):
    b = {"type": type_, "sets": sets, "restBetweenSetsSec": restSets, "exercises": exercises or []}
    if restEx is not None: b["restBetweenExercisesSec"] = restEx
    return b

def model(mid, name, intensity, total, blocks):
    return {"id": mid, "name": name, "intensity": intensity, "totalTimeMin": total, "blocks": blocks}

handstand_models = [
  model("hs-r1-n1", "Refuerzo R1 - Nivel 1", 2, 20, [
    blk("single", 4, 120, exercises=[ex("Flexiones en pica (buscando profundidad)", reps="4-8")]),
    blk("single", 3, 90, exercises=[ex("Fondos escapulares (buscando inclinación)", reps="6-10")]),
    blk("biseries", 3, 90, exercises=[ex("Plancha en T dinámica a una mano", 20, notes="x brazo"), ex("Lean planche", 10)]),
    blk("single", 2, 60, exercises=[ex("Empujes de pino con cadencia 5-3 (banda)", reps="3")]),
  ]),
  model("hs-r2-n1", "Refuerzo R2 - Nivel 1", 2, 20, [
    blk("single", 4, 90, exercises=[ex("De pica a lean en pasos (pies en altura)", reps="4-5")]),
    blk("single", 3, 90, exercises=[ex("Arrastres en pica (pies en altura)", reps="3-4")]),
    blk("biseries", 3, 90, exercises=[ex("Flexiones lean planche", reps="4-6"), ex("Lean planche", 10, notes="8-10s")]),
    blk("biseries", 3, 60, exercises=[ex("Plancha en T dinámica", 20, notes="x brazo"), ex("Plank en suelo", 20)]),
  ]),
  model("hs-r1-n2", "Refuerzo R1 - Nivel 2", 2, 20, [
    blk("single", 4, 150, exercises=[ex("Aguantes de pino en pared", 35, notes="30-40s")]),
    blk("single", 4, 120, exercises=[ex("Flexiones en pica (pies en altura)", reps="8-10")]),
    blk("biseries", 3, 90, exercises=[ex("Arrastres de pies (straddle) flexión a pica", reps="4-6"), ex("Hold en pica arriba", 5, notes="pies en straddle")]),
    blk("single", 3, 90, exercises=[ex("Flexiones supinas (cabeza en pared)", reps="4-6")]),
  ]),
  model("hs-r2-n2", "Refuerzo R2 - Nivel 2", 2, 20, [
    blk("single", 4, 150, exercises=[ex("Flexiones en pino parciales (pared)", reps="4-8")]),
    blk("single", 3, 150, exercises=[ex("Flexiones en pica 90º (profundidad)", reps="4-8")]),
    blk("single", 3, 90, exercises=[ex("Botes de pies pica straddle (altura)", 10, notes="8-10s")]),
  ]),
  model("hs-r1-n3", "Refuerzo R1 - Nivel 3", 3, 20, [
    blk("single", 4, 150, exercises=[ex("Flexiones en pino completas (pared)", reps="4-8")]),
    blk("single", 3, 120, exercises=[ex("Flexiones en pica 90º (pies en altura)", reps="4-8")]),
    blk("single", 3, 90, exercises=[ex("Arrastres flexión a pica (straddle)", reps="3-4", notes="elevando pies")]),
    blk("single", 3, 90, exercises=[ex("Hold de pino en pared", 35, notes="30-40s")]),
  ]),
  model("hs-r2-n3", "Refuerzo R2 - Nivel 3", 3, 20, [
    blk("single", 4, 180, exercises=[ex("Arrastrar flexión a pica (straddle)", reps="3-4", notes="elevando pies")]),
    blk("biseries", 3, 150, exercises=[ex("Flexiones pino en pared", reps="4-6"), ex("Flexiones en pica", reps="8-10")]),
    blk("biseries", 3, 90, exercises=[ex("Flexiones supina en suelo", 10, notes="8-10s"), ex("Plancha dinámica en T", 20, notes="x brazo")]),
    blk("biseries", 2, 90, exercises=[ex("Plancha dinámica en T", 20, notes="x brazo"), ex("Lean planche", 15, notes="buscando inclinación")]),
  ]),
  model("hs-balance-n1", "Balance - Nivel 1 (sin pino)", 1, 8, [
    blk("single", 3, 60, exercises=[ex("Elevaciones de piernas en pica (rodillas estiradas)", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("Arrastrar piernas en altura (pica, pierna estirada)", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("Saltos pequeños en pica (una pierna estirada)", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("Saltos completos en pica (alternando)", reps="5-10")]),
  ]),
  model("hs-balance-n2", "Balance - Nivel 2 (pino en pared)", 2, 8, [
    blk("single", 3, 60, exercises=[ex("Subidas y bajadas de pino en pared", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("Cambiar piernas en pino en pared", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("Alternar piernas en pino en pared", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("De tijera a full en pino separado", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("Intentar pino desde la pared", reps="5-10")]),
  ]),
  model("hs-balance-n3", "Balance - Nivel 3 (pino por libre)", 3, 8, [
    blk("single", 3, 60, exercises=[ex("Patadas contra la pared (dejar de tocar)", reps="5-10")]),
    blk("single", 3, 60, exercises=[ex("Intentos de pino por libre", reps="5-10")]),
  ]),
  model("hs-pino-fuerza", "Pino por fuerza - Nivel 4", 3, 12, [
    blk("single", 4, 180, exercises=[ex("De pica 90 salto a pared", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("De pica 90 salto a pared + negativa", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("De pica 90 salto + negativa por libre", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("Desde rana subida a pino contra pared", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("Desde rana subida a pino por libre", reps="3-5")]),
    blk("single", 4, 180, exercises=[ex("Desde rana subida a pino + bajada", reps="3-5")]),
  ]),
  model("handstand-benchmark", "Desbloquear", 1, 5, [
    blk("single", 1, 0, exercises=[ex("Pino por libre", 40, notes="Anota el resultado en Progreso semanal", tags=["isometricos"])]),
  ]),
]

PRINCIPIANTE_IDS = {"hs-r1-n1", "hs-r2-n1", "hs-balance-n1"}
INTERMEDIO_IDS = {"hs-r1-n2", "hs-r2-n2", "hs-balance-n2"}
AVANZADO_IDS = {"hs-r1-n3", "hs-r2-n3", "hs-balance-n3", "hs-pino-fuerza", "handstand-benchmark"}

def make_program(pid, name, level, models):
    return {
        "id": pid,
        "categoryId": "handstand",
        "name": name,
        "level": level,
        "description": "Programa de handstand.",
        "objectives": ["Dominar el pino al 100%", "Ganar resistencia", "Ganar fuerza", "Ganar equilibrio"],
        "goals": [],
        "frequency": "varias×/sem",
        "restBetweenSessions": "48h",
        "rules": ["Las rutinas de refuerzo no se compaginan con otras rutinas el mismo día.", "Dominar cada ejercicio antes de pasar al siguiente."],
        "models": models,
    }

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    if c["id"] == "handstand":
        c["programs"] = [
            make_program("handstand-principiante", "Handstand - Principiante", "beginner", [m for m in handstand_models if m["id"] in PRINCIPIANTE_IDS]),
            make_program("handstand-intermedio", "Handstand - Intermedio", "intermediate", [m for m in handstand_models if m["id"] in INTERMEDIO_IDS]),
            make_program("handstand-avanzado", "Handstand - Avanzado", "advanced", [m for m in handstand_models if m["id"] in AVANZADO_IDS]),
        ]

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("handstand merged: 3 programs")
PY