#!/usr/bin/env python3
"""Set (or replace) the video URL for a single exercise.

Usage:
  python3 scripts/set_exercise_video.py "Nombre del ejercicio" "https://www.youtube.com/watch?v=VIDEOID"
  python3 scripts/set_exercise_video.py "Nombre" "https://youtu.be/VIDEOID"
  python3 scripts/set_exercise_video.py --list   # list exercises without video
"""
import argparse, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data", "plans.json")
VIDEOS = os.path.join(ROOT, "scripts", "output", "exercise-videos.json")

def video_id_from(url):
    m = re.search(r"(?:v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})", url)
    if not m:
        raise ValueError(f"no se pudo extraer el id de YouTube de: {url}")
    return m.group(1)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("name", nargs="?")
    ap.add_argument("url", nargs="?")
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()

    plans = json.load(open(DATA, encoding="utf-8"))
    videos = json.load(open(VIDEOS, encoding="utf-8")) if os.path.exists(VIDEOS) else {}

    if args.list:
        names = {e["name"] for c in plans["categories"] for p in c["programs"] for m in p["models"] for b in m["blocks"] for e in b["exercises"]}
        missing = sorted(n for n in names if not videos.get(n, {}).get("id"))
        print(f"{len(missing)} ejercicios sin video:")
        for n in missing:
            print(f"  - {n}")
        return 0

    if not args.name or not args.url:
        ap.error("faltan name y url (o usa --list)")

    vid = video_id_from(args.url)
    record = {
        "id": vid,
        "title": args.name,
        "channel": "",
        "url": f"https://www.youtube.com/watch?v={vid}",
        "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
        "pdf": None,
        "program": None,
        "model": None,
        "status": "manual",
    }
    videos[args.name] = record

    changed = 0
    for c in plans["categories"]:
        for p in c["programs"]:
            for m in p["models"]:
                for b in m["blocks"]:
                    for e in b["exercises"]:
                        if e.get("name") == args.name:
                            e["video"] = {k: record[k] for k in ("id","title","channel","url","thumbnail")}
                            changed += 1

    with open(VIDEOS, "w", encoding="utf-8") as f:
        json.dump(videos, f, ensure_ascii=False, indent=2)
        f.write("\n")
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(plans, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"actualizado '{args.name}' -> {vid} ({changed} instancias)")

if __name__ == "__main__":
    sys.exit(main())
