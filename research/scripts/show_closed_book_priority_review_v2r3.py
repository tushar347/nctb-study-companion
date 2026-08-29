import csv
import json
import re
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

PRIORITY = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_priority_review_v2r3.csv"
)

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)


def normalize_space(text):
    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()


sources = {}

with SOURCE.open(
    "r",
    encoding="utf-8-sig",
) as handle:

    for line in handle:

        line = line.strip()

        if not line:
            continue

        record = json.loads(line)

        sources[
            record["chunk_id"]
        ] = record


with PRIORITY.open(
    "r",
    encoding="utf-8-sig",
    newline="",
) as handle:

    rows = list(
        csv.DictReader(handle)
    )


print()
print("=" * 90)
print("CLOSED-BOOK BENCHMARK - 8 PRIORITY REVIEW ITEMS")
print("=" * 90)

print(
    "Items:",
    len(rows)
)


for index, row in enumerate(
    rows,
    start=1,
):

    chunk_id = row[
        "chunk_id"
    ]

    source = sources.get(
        chunk_id,
        {}
    )

    source_text = normalize_space(
        source.get(
            "text",
            ""
        )
    )

    evidence = normalize_space(
        row[
            "evidence_quote"
        ]
    )

    # Find evidence position so we can show
    # useful nearby textbook context.
    position = source_text.casefold().find(
        evidence.casefold()
    )

    if position >= 0:

        start = max(
            0,
            position - 350,
        )

        end = min(
            len(source_text),
            position
            + len(evidence)
            + 350,
        )

        context = source_text[
            start:end
        ]

    else:

        context = source_text[:900]


    print()
    print("=" * 90)

    print(
        f"[{index}] "
        f"{row['candidate_id']} "
        f"| Class {row['class_level']} "
        f"| pages {row['page_start']}-{row['page_end']}"
    )

    print(
        "Chunk:",
        chunk_id
    )

    print(
        "Review reason:",
        row[
            "review_reasons"
        ]
    )

    print()

    print(
        "QUESTION:"
    )

    print(
        row[
            "question"
        ]
    )

    print()

    print(
        "GOLD ANSWER:"
    )

    print(
        row[
            "gold_answer"
        ]
    )

    print()

    print(
        "EVIDENCE:"
    )

    print(
        row[
            "evidence_quote"
        ]
    )

    print()

    print(
        "SOURCE CONTEXT:"
    )

    print(
        context
    )


print()
print("=" * 90)
print(
    "END OF PRIORITY REVIEW"
)
print("=" * 90)
