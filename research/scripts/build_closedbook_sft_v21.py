import json
import random
from pathlib import Path
from collections import defaultdict, Counter

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "sft"
    / "final_v2"
    / "nctb_sft_train_v2.jsonl"
)

OUT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "sft"
    / "final_v2"
    / "nctb_sft_closedbook_train_v21.jsonl"
)

rows = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:
        line = line.strip()
        if line:
            rows.append(json.loads(line))


def convert(row):

    task = row["task_type"]

    # EVERY task becomes:
    # Question only -> Answer

    if task == "mcq":

        answer = row["correct_answer"]

    else:

        answer = row.get(
            "answer",
            ""
        )

    return {
        "class_level":
            int(row["class_level"]),

        "source_chunk_ids":
            row["source_chunk_ids"],

        "task_type":
            "closed_book_qa",

        "question":
            row["question"],

        "answer":
            answer,

        "evidence_quote":
            row["evidence_quote"],
    }


converted = [
    convert(row)
    for row in rows
]


# ---------------------------------------------------------
# Balance classes by deterministic oversampling.
# ---------------------------------------------------------

by_class = defaultdict(list)

for row in converted:
    by_class[
        row["class_level"]
    ].append(row)


target = max(
    len(v)
    for v in by_class.values()
)


rng = random.Random(20260812)

balanced = []

for cls in [6, 7, 8]:

    items = by_class[cls]

    expanded = []

    while len(expanded) < target:

        shuffled = items.copy()
        rng.shuffle(shuffled)

        expanded.extend(
            shuffled
        )

    balanced.extend(
        expanded[:target]
    )


rng.shuffle(
    balanced
)


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

with OUT.open(
    "w",
    encoding="utf-8"
) as f:

    for i, row in enumerate(
        balanced,
        1
    ):

        row["example_id"] = (
            f"NCTB-V21-{i:05d}"
        )

        f.write(
            json.dumps(
                row,
                ensure_ascii=False
            ) + "\n"
        )


print()
print("=" * 78)
print("V2.1 CLOSED-BOOK SFT DATASET")
print("=" * 78)

print(
    "Original:",
    len(converted)
)

print(
    "Balanced:",
    len(balanced)
)

print(
    "Class counts:",
    dict(
        Counter(
            x["class_level"]
            for x in balanced
        )
    )
)

print(
    "Output:",
    OUT
)
