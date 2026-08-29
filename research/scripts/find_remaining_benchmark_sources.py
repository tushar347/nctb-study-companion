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

TARGETS = {
    7: ["Rupa", "arrangement of the words", "America at Play"],
    8: ["Hason Raja", "dwelling", "folk music", "boatmen"],
}

with SOURCE.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:

        line = line.strip()

        if not line:
            continue

        row = json.loads(line)

        level = int(row["class_level"])

        if level not in TARGETS:
            continue

        text = row["text"]
        lower = text.casefold()

        if any(
            key.casefold() in lower
            for key in TARGETS[level]
        ):

            print()
            print("=" * 90)
            print(
                row["chunk_id"],
                "| Class",
                level,
                "| pages",
                row["page_start"],
                "-",
                row["page_end"],
            )
            print("=" * 90)
            print(text)

