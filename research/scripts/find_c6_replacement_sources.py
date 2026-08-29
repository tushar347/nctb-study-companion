import json
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)

SEARCH = {
    "C6-022": [
        "poet",
        "cloud",
        "prettier far than these",
    ],
    "C6-034": [
        "Ahsan Manzil",
        "Ahsan",
        "capital of ancient Bengal",
    ],
}

for label, keywords in SEARCH.items():

    print()
    print("=" * 90)
    print(label)
    print("=" * 90)

    found = 0

    with SOURCE.open(
        "r",
        encoding="utf-8-sig"
    ) as f:

        for line in f:

            line = line.strip()

            if not line:
                continue

            row = json.loads(line)

            if int(row["class_level"]) != 6:
                continue

            text = row["text"]

            if not any(
                keyword.casefold()
                in text.casefold()
                for keyword in keywords
            ):
                continue

            print()
            print(
                row["chunk_id"],
                "| pages",
                row["page_start"],
                "-",
                row["page_end"],
            )

            print()
            print(text)

            found += 1

            if found >= 3:
                break

    if found == 0:
        print("No matching Class 6 chunks found.")
