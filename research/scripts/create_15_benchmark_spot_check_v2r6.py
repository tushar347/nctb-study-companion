import json
import random
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT / "research" / "data" / "v2" / "evaluation"
    / "closed_book_eval_candidates_v2r6.jsonl"
)

OUTPUT = (
    ROOT / "research" / "data" / "v2" / "evaluation"
    / "closed_book_eval_15_spot_check_v2r6.jsonl"
)

items = []

with SOURCE.open("r", encoding="utf-8-sig") as f:
    for line in f:
        line = line.strip()
        if line:
            items.append(json.loads(line))

rng = random.Random(20260813)

selected = []

for class_level in [6, 7, 8]:
    group = [
        x for x in items
        if int(x["class_level"]) == class_level
    ]
    selected.extend(rng.sample(group, 5))

with OUTPUT.open("w", encoding="utf-8") as f:
    for item in selected:
        f.write(
            json.dumps(item, ensure_ascii=False) + "\n"
        )

print()
print("=" * 78)
print("V2R6 — FRESH 15-QUESTION SPOT CHECK")
print("=" * 78)

for i, item in enumerate(selected, 1):
    print()
    print(
        f"[{i}/15] {item['candidate_id']} "
        f"| Class {item['class_level']}"
    )
    print("Q:", item["question"])
    print("A:", item["gold_answer"])
    print("Evidence:", item["evidence_quote"])

print()
print(
    "Saved:",
    OUTPUT.relative_to(ROOT)
)
