import json, os

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

cardio_models = [
  model("cardio-r1", "Rutina 1", 2, 14, [
    blk("superseries", 3, 60, 0, [
      ex("Plancha alternando mano a hombro", 15),
      ex("Mountains Climbers", 15),
      ex("Crunch alternando rodillas", 15),
      ex("Isometría sentadilla 90 grados en pared", 30),
    ]),
    blk("superseries", 3, 60, 0, [
      ex("Zancadas equilibrio pierna derecha", 15),
      ex("Zancadas equilibrio pierna izquierda", 15),
      ex("Sentadillas con salto", 20),
      ex("Plank", 30),
    ]),
    blk("superseries", 2, 0, 0, [
      ex("De pica a plancha (andando) y subir", 15),
      ex("Elevaciones de piernas en pica", 15),
      ex("Extensión lumbar alternando pies y brazos", 20),
      ex("Jumping Jacks", 30),
    ]),
  ]),
  model("cardio-r2", "Rutina 2", 3, 8, [
    blk("superseries", 1, 60, 0, [
      ex("Jumping Jacks", 20),
      ex("De plank a plancha codos estirados cambiando", 20),
      ex("Plancha lateral en T dinámica (brazo 1)", 15),
      ex("Plancha lateral en T dinámica (brazo 2)", 15),
      ex("Puente Femoral con isometría quitando piernas", 30),
      ex("Crunch alternando rodillas", 20),
      ex("Impossible Lift", 20),
      ex("Leg raises sentado alternando piernas", 20),
    ]),
    blk("superseries", 2, 30, 30, [
      ex("De pica a posición de plancha y volver", 20),
      ex("Mountain climbers", 15),
      ex("Zancadas dinámicas", 20),
      ex("Sentadillas normales", 20),
      ex("Leg raises tumbado flexionando y estirando piernas", 20),
      ex("Extensiones lumbares alternando piernas y brazos", 20),
    ]),
  ]),
  model("cardio-r3", "Rutina 3", 2, 10, [
    blk("superseries", 1, 30, 0, [
      ex("Flexiones con rotación en T", 20),
      ex("Burpees", 20),
      ex("Mountain climbers", 20),
      ex("Zancadas con salto", 20),
    ]),
    blk("superseries", 1, 30, 0, [
      ex("Crunch alternando rodillas", 20),
      ex("Hollow body dinámico flexión de piernas", 20),
      ex("Plank", 20),
    ]),
    blk("superseries", 3, 30, 40, [
      ex("Flexiones en suelo", 15),
      ex("Spiderman estático", 20),
      ex("De plank a plancha codos estirados y volver", 20),
    ]),
    blk("superseries", 2, 20, 20, [
      ex("Flexiones de cadera en impossible en suelo", 20),
      ex("Impossible lift", 20),
      ex("Reverse Plank", 20),
    ]),
  ]),
  model("cardio-r4", "Rutina 4", 2, 15, [
    blk("superseries", 3, 30, 0, [
      ex("Zancadas estáticas cortas ritmo rápido (pierna 1)", 15),
      ex("Zancadas estáticas cortas ritmo rápido (pierna 2)", 15),
      ex("Zancadas con salto alternando", 20),
      ex("Sentadilla predicador", 20),
      ex("Puente femoral con isometrías en extensión alternando", 20),
      ex("Puente femoral con dos piernas", 20),
      ex("Extensión lateral de glúteo y frontal (pierna 1)", 20),
      ex("Extensión lateral de glúteo y frontal (pierna 2)", 20),
    ]),
    blk("superseries", 2, 30, 0, [
      ex("Elevaciones en L sit sentado alternando", 20),
      ex("Leg raises acostado", 20),
      ex("Oblicuos en suelo (lado 1)", 15),
      ex("Oblicuos en suelo (lado 2)", 15),
      ex("Extensión lumbar alternando", 20),
      ex("Crunch alternando rodillas", 20),
    ]),
  ]),
  model("cardio-r5", "Rutina 5", 3, 15, [
    blk("superseries", 3, 60, 0, [
      ex("Elevaciones de piernas en pica", 20),
      ex("De pica a plancha brazos estirados y volver", 20),
      ex("Plank lateral dinámica de brazo a brazo", 20),
      ex("Lean planche", 10),
    ]),
    blk("superseries", 3, 60, 0, [
      ex("Elevaciones de piernas en impossible lift", 20),
      ex("Reverse plank", 15),
      ex("Extensión lumbar alternando piernas y brazos", 20),
      ex("Lean planche", 10),
    ]),
    blk("superseries", 3, 60, 0, [
      ex("Sentadilla predicador", 20),
      ex("Sentadillas con salto", 20),
      ex("Puente femoral alternando piernas con isometría", 20),
      ex("Zancadas alternando piernas", 20),
    ]),
  ]),
]

cardio_program = {
  "id": "cardio-casa",
  "categoryId": "cardio",
  "name": "Cardio en casa",
  "level": "beginner",
  "description": "Rutinas pensadas para personas con poco contacto con el deporte. Series organizadas por tiempo. Entrenar 3-4 veces por semana.",
  "objectives": ["Acondicionamiento del cuerpo", "Hacer rutinas más frecuentemente", "Ganar resistencia", "Ganar base muscular"],
  "goals": [
    {"id": "cardio-sesiones", "name": "Completar sesiones", "unit": "reps", "target": 10},
    {"id": "cardio-plank", "name": "Hold plank", "unit": "sec", "target": 60}
  ],
  "frequency": "3-4×/sem",
  "restBetweenSessions": "24-48h",
  "rules": ["Se puede aumentar el tiempo añadiendo más series."],
  "models": cardio_models,
}

categories = [
  {"id":"cardio","name":"Cardio","description":"Rutinas en casa para todos los niveles.","programs":[cardio_program]},
  {"id":"movilidad","name":"Movilidad & Flexibilidad","description":"Calentamiento y movilidad por grupo muscular (8 modelos).","programs":[]},
  {"id":"handstand","name":"Handstand","description":"Movilidad, refuerzo (3 niveles), balance y pino por fuerza.","programs":[]},
  {"id":"hefesto","name":"Hefesto","description":"Principiantes: acondicionamiento + H1/H2/H3.","programs":[]},
  {"id":"backlever-hefesto","name":"Back Lever Hefesto","description":"Master: niveles 1 y 2 × 3 intensidades.","programs":[]},
  {"id":"frontlever","name":"Front Lever","description":"Intermedios y avanzados.","programs":[]},
  {"id":"planche","name":"Planche","description":"Fuerza (sin/con equipamiento) y resistencia.","programs":[]},
  {"id":"fuerza","name":"Fuerza","description":"Básicos: principiantes, intermedios, avanzados.","programs":[]},
]

data = {"categories": categories}
os.makedirs("/home/tomiban/Documentos/rutinas/app/src/data", exist_ok=True)
with open("/home/tomiban/Documentos/rutinas/app/src/data/plans.json","w") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("written", sum(len(c["programs"]) for c in categories), "programs")
