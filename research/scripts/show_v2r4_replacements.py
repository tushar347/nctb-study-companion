import json
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

FILE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r4_reviewed.jsonl"
)

items = []

with FILE.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:

        line = line.strip()

        if not line:
            continue

        row = json.loads(line)

        if (
            row.get(
                "human_review_action"
            )
            == "REPLACEMENT_CANDIDATE"
        ):

            items.append(row)


print()
print("=" * 90)
print("V2R4 REPLACEMENT QUESTIONS")
print("=" * 90)

print(
    "Replacement items:",
    len(items)
)

for i, row in enumerate(
    items,
    start=1
):

    print()
    print("=" * 90)

    print(
        f"[{i}] "
        f"{row['candidate_id']} "
        f"| Class {row['class_level']} "
        f"| pages {row['page_start']}-{row['page_end']}"
    )

    print(
        "Chunk:",
        row["chunk_id"]
    )

    print()

    print("QUESTION:")
    print(
        row["question"]
    )

    print()

    print("GOLD ANSWER:")
    print(
        row["gold_answer"]
    )

    print()

    print("EVIDENCE:")
    print(
        row["evidence_quote"]
    )

print()
print("=" * 90)
print("END")
print("=" * 90)
