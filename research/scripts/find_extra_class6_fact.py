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

KEYWORDS = [
    "Boat",
    "Bangladesh Army",
    "Concert for Bangladesh",
    "Mamun",
    "Rural Bangladesh",
    "Pahela Boishakh",
    "Nabanna",
]

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
            k.casefold() in text.casefold()
            for k in KEYWORDS
        ):
            continue

        print()
        print("=" * 90)
        print(row["chunk_id"])
        print("Pages:", row["page_start"], "-", row["page_end"])
        print("=" * 90)
        print(text)
