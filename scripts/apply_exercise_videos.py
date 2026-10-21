#!/usr/bin/env python3
"""Projects the raw exercise-video data onto `app/src/data/plans.json`.

Input:  `scripts/output/exercise-videos.json` (exercise name -> video).
Output: `app/src/data/plans.json`, with a `video` field on every resolved exercise.

The merge is idempotent and total: the `video` state in `plans.json` is always the
projection of the raw file (an exercise without a match keeps no `video` field).

Usage:
  python3 scripts/apply_exercise_videos.py            # writes
  python3 scripts/apply_exercise_videos.py --check    # verifies without writing
  python3 scripts/apply_exercise_videos.py --stats    # coverage only
"""
import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "app", "src", "data", "plans.json")
VIDEOS = os.path.join(ROOT, "scripts", "output", "exercise-videos.json")

VIDEO_FIELDS = ("id", "title", "channel", "url", "thumbnail")


def load(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def video_of(record: dict | None) -> dict | None:
    """`video` payload for an exercise, or None when there is no match."""
    if not record or not record.get("id"):
        return None
    return {k: record.get(k) for k in VIDEO_FIELDS}


def iter_exercises(plans: dict):
    for category in plans["categories"]:
        for program in category["programs"]:
            for model in program["models"]:
                for block in model["blocks"]:
                    for exercise in block["exercises"]:
                        yield exercise


def project(plans: dict, videos: dict) -> tuple[list[str], int, int]:
    """Applies the projection of `videos` onto `plans`."""
    changed: list[str] = []
    matched_instances = 0
    total_instances = 0
    for exercise in iter_exercises(plans):
        total_instances += 1
        expected = video_of(videos.get(exercise.get("name")))
        current = exercise.get("video")
        if expected is None:
            if current is not None:
                del exercise["video"]
                changed.append(exercise.get("name"))
            continue
        matched_instances += 1
        if current != expected:
            exercise["video"] = expected
            changed.append(exercise.get("name"))
    return changed, matched_instances, total_instances


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verifica sin escribir")
    parser.add_argument("--stats", action="store_true", help="solo cobertura")
    parser.add_argument("--videos", default=VIDEOS, help="archivo crudo de videos")
    args = parser.parse_args()

    if not os.path.exists(args.videos):
        print(f"no existe {args.videos}; ejecuta primero scripts/collect_exercise_videos.mjs")
        return 1

    videos = load(args.videos)
    plans = load(DATA)

    snapshot = json.dumps(plans, ensure_ascii=False, sort_keys=True)
    changed, matched, total = project(plans, videos)

    names = {e.get("name") for e in iter_exercises(load(DATA))}
    names_with_video = sum(1 for n in names if video_of(videos.get(n)))
    print(
        f"ejercicios: {total} instancias / {len(names)} nombres | "
        f"con video: {matched} instancias ({names_with_video} nombres) | "
        f"cambios: {len(changed)}"
    )

    if args.stats:
        missing = sorted(n for n in names if not video_of(videos.get(n)))
        if missing:
            print("sin video:")
            for name in missing:
                print(f"  - {name}")
        return 0

    if args.check:
        after = json.dumps(plans, ensure_ascii=False, sort_keys=True)
        if snapshot != after:
            print("plans.json esta desactualizado respecto al dato crudo")
            for name in changed[:20]:
                print(f"  - {name}")
            return 1
        print("plans.json esta sincronizado")
        return 0

    if changed:
        with open(DATA, "w", encoding="utf-8") as f:
            json.dump(plans, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"plans.json actualizado ({len(changed)} ejercicios)")
    else:
        print("plans.json sin cambios")
    return 0


if __name__ == "__main__":
    sys.exit(main())
