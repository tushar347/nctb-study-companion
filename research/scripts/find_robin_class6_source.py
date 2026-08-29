import json
import re
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
    "Robin",
    "Uncle",
    "Aunt",
    "things that I didn't know",
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
            keyword.casefold()
            in text.casefold()
            for keyword in KEYWORDS
        ):
            continue

        print()
        print("=" * 90)
        print(
            row["chunk_id"],
            "| pages",
            row["page_start"],
            "-",
            row["page_end"],
        )
        print("=" * 90)

        # Print the relevant portions only.
        sentences = re.split(
            r"(?<=[.!?])\s+",
            text,
        )

        for sentence in sentences:

            lower = sentence.casefold()

            if any(
                keyword.casefold()
                in lower
                for keyword in KEYWORDS
            ):

                print(
                    sentence.strip()
                )

