import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data", "plans.json")

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

planche = next(c for c in data["categories"] if c["id"] == "planche")
progs = {p["id"]: p for p in planche["programs"]}

def merge_models(ids, allowed=None):
    out = []
    seen = set()
    for pid in ids:
        p = progs.get(pid)
        if not p: continue
        for m in p.get("models", []):
            if allowed is not None and m["id"] not in allowed:
                continue
            if m["id"] in seen: continue
            seen.add(m["id"])
            out.append(m)
    return out

# Tuck: solo R1-R5 (sin PRO1) + PR1-3 de resistencia nivel 1
tuck_force_ids = ["pl-r1","pl-r2","pl-r3","pl-r4","pl-r5","pl-pro1"]
tuck_res_ids = ["res-n1-pr1","res-n1-pr2","res-n1-pr3"]

tuck = {
    "id": "planche-tuck",
    "categoryId": "planche",
    "name": "Tuck Planche",
    "level": "intermediate",
    "description": "Progresión Tuck: R1-R5 + resistencia PR1-PR3 (nivel 1).",
    "objectives": ["Ganar fuerza de tuck planche", "Ganar resistencia"],
    "goals": [],
    "frequency": "2-3×/sem",
    "restBetweenSessions": "48-72h",
    "rules": ["Descansos largos entre series.", "Realizar resistencia al final de fuerza."],
    "models": merge_models(["planche-fuerza", "planche-resistencia"], set(tuck_force_ids + tuck_res_ids)),
    "optional": True,
}

tuckadv = progs.get("planche-tuckadv")
straddle = progs.get("planche-straddle")
full = progs.get("planche-full")

new_programs = [tuck]
if tuckadv: new_programs.append(tuckadv)
if straddle: new_programs.append(straddle)
if full: new_programs.append(full)

planche["programs"] = new_programs

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("consolidated:", [p["id"] for p in new_programs])
