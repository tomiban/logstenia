import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data", "plans.json")

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    for p in c["programs"]:
        if c["id"] in ("planche", "frontlever"):
            p["models"] = [m for m in p["models"] if not m["id"].endswith("-benchmark")]
            continue
        if p["id"].startswith("planche-"):
            # planche uses PRO1 as benchmark; remove generic benchmark if present
            p["models"] = [m for m in p["models"] if not m["id"].endswith("-benchmark")]
            continue
        if any(m["id"].endswith("-benchmark") for m in p["models"]):
            continue
        p["models"].append({
            "id": p["id"] + "-benchmark",
            "name": "Toma de marcas",
            "intensity": 1,
            "totalTimeMin": 5,
            "blocks": [
                {
                    "type": "single",
                    "sets": 1,
                    "restBetweenSetsSec": 0,
                    "exercises": [
                        {"name": "Registrar marca (max hold)", "reps": "max", "notes": "Anota el resultado en Progreso semanal"}
                    ]
                }
            ]
        })

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("benchmarks added")
