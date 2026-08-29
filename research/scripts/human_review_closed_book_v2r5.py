from __future__ import annotations

import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r5_reviewed.jsonl"
)

EVAL_SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)

PROGRESS = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_human_review_progress_v2r5.json"
)

CSV_OUT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_human_review_progress_v2r5.csv"
)

EXPECTED_SHA = (
    "f8052fa847a350606b52f8a3fbe10c3424171478ad92683097acf37bb19473c6"
)


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as f:
        for block in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            digest.update(block)

    return digest.hexdigest()


def clean(text):
    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()


actual_sha = sha256_file(
    SOURCE
)

if actual_sha != EXPECTED_SHA:
    raise SystemExit(
        "STOP: Benchmark candidate SHA mismatch.\n"
        f"Expected: {EXPECTED_SHA}\n"
        f"Actual:   {actual_sha}"
    )


items = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:
        line = line.strip()

        if line:
            items.append(
                json.loads(line)
            )


chunks = {}

with EVAL_SOURCE.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:
        line = line.strip()

        if line:
            row = json.loads(line)

            chunks[
                row["chunk_id"]
            ] = row


if PROGRESS.exists():

    progress = json.loads(
        PROGRESS.read_text(
            encoding="utf-8"
        )
    )

else:

    progress = {}


def save_progress():

    PROGRESS.write_text(
        json.dumps(
            progress,
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    fields = [
        "candidate_id",
        "class_level",
        "question",
        "gold_answer",
        "decision",
        "edited_question",
        "edited_answer",
        "notes",
    ]

    with CSV_OUT.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as f:

        writer = csv.DictWriter(
            f,
            fieldnames=fields,
        )

        writer.writeheader()

        for item in items:

            cid = item[
                "candidate_id"
            ]

            review = progress.get(
                cid,
                {}
            )

            writer.writerow(
                {
                    "candidate_id":
                        cid,

                    "class_level":
                        item[
                            "class_level"
                        ],

                    "question":
                        item[
                            "question"
                        ],

                    "gold_answer":
                        item[
                            "gold_answer"
                        ],

                    "decision":
                        review.get(
                            "decision",
                            ""
                        ),

                    "edited_question":
                        review.get(
                            "edited_question",
                            ""
                        ),

                    "edited_answer":
                        review.get(
                            "edited_answer",
                            ""
                        ),

                    "notes":
                        review.get(
                            "notes",
                            ""
                        ),
                }
            )


reviewed = sum(
    1
    for item in items
    if item[
        "candidate_id"
    ] in progress
)


print()
print("=" * 80)
print("FINAL HUMAN REVIEW - NCTB CLOSED-BOOK BENCHMARK")
print("=" * 80)

print(
    "Candidate SHA256:",
    actual_sha
)

print(
    "Previously reviewed:",
    reviewed,
    "/",
    len(items)
)

print()
print(
    "A = Accept | E = Edit | R = Reject | Q = Save and quit"
)


for index, item in enumerate(
    items,
    start=1,
):

    cid = item[
        "candidate_id"
    ]

    if cid in progress:
        continue


    source = chunks.get(
        item[
            "chunk_id"
        ],
        {}
    )

    source_text = clean(
        source.get(
            "text",
            ""
        )
    )

    evidence = clean(
        item.get(
            "evidence_quote",
            ""
        )
    )


    position = (
        source_text
        .casefold()
        .find(
            evidence.casefold()
        )
    )

    if position >= 0:

        start = max(
            0,
            position - 250,
        )

        end = min(
            len(source_text),
            position
            + len(evidence)
            + 250,
        )

        context = source_text[
            start:end
        ]

    else:

        context = source_text[:700]


    print()
    print("=" * 80)

    completed = len(
        progress
    )

    print(
        f"[{index}/150] "
        f"{cid} "
        f"| Class {item['class_level']} "
        f"| Reviewed {completed}/150"
    )

    print()

    print("QUESTION:")
    print(
        item[
            "question"
        ]
    )

    print()

    print("GOLD ANSWER:")
    print(
        item[
            "gold_answer"
        ]
    )

    print()

    print("EVIDENCE:")
    print(
        evidence
    )

    print()

    print("SOURCE CONTEXT:")
    print(
        context
    )

    print()


    while True:

        decision = input(
            "Decision [A/E/R/Q]: "
        ).strip().upper()

        if decision in {
            "A",
            "E",
            "R",
            "Q",
        }:
            break


    if decision == "Q":

        save_progress()

        print()
        print(
            "Progress saved."
        )

        print(
            "Reviewed:",
            len(progress),
            "/ 150"
        )

        raise SystemExit


    if decision == "A":

        progress[
            cid
        ] = {
            "decision":
                "ACCEPT",

            "edited_question":
                "",

            "edited_answer":
                "",

            "notes":
                "",
        }


    elif decision == "E":

        edited_question = input(
            "Edited question: "
        ).strip()

        edited_answer = input(
            "Edited answer "
            "(Enter to keep current): "
        ).strip()

        if not edited_answer:

            edited_answer = (
                item[
                    "gold_answer"
                ]
            )

        notes = input(
            "Notes "
            "(optional): "
        ).strip()


        progress[
            cid
        ] = {
            "decision":
                "EDIT",

            "edited_question":
                edited_question,

            "edited_answer":
                edited_answer,

            "notes":
                notes,
        }


    elif decision == "R":

        reason = input(
            "Reason for rejection: "
        ).strip()

        progress[
            cid
        ] = {
            "decision":
                "REJECT",

            "edited_question":
                "",

            "edited_answer":
                "",

            "notes":
                reason,
        }


    save_progress()


print()
print("=" * 80)
print("HUMAN REVIEW COMPLETE")
print("=" * 80)

decisions = {}

for review in progress.values():

    decision = review[
        "decision"
    ]

    decisions[
        decision
    ] = (
        decisions.get(
            decision,
            0
        )
        + 1
    )


print(
    "Total reviewed:",
    len(progress)
)

print(
    "Accepted:",
    decisions.get(
        "ACCEPT",
        0
    )
)

print(
    "Edited:",
    decisions.get(
        "EDIT",
        0
    )
)

print(
    "Rejected:",
    decisions.get(
        "REJECT",
        0
    )
)

print()

print(
    "Progress JSON:",
    PROGRESS.relative_to(
        ROOT
    )
)

print(
    "Review CSV:",
    CSV_OUT.relative_to(
        ROOT
    )
)

print()
print(
    "NEXT: build final benchmark from human decisions."
)
