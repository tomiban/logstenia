import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data", "plans.json")

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

for c in data["categories"]:
    for p in c["programs"]:
        for m in p["models"]:
            if m["name"].upper() == "PRO1" or m["id"].endswith("-benchmark"):
                m["benchmark"] = True

with open(DATA, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print("benchmarks marked")
