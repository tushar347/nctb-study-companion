import json
import re
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

BENCHMARK = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r8.jsonl"
)

EVAL_SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)

BAD_IDS = {
    "CBQ-C6-001",
    "CBQ-C7-001",
    "CBQ-C7-006",
    "CBQ-C7-008",
    "CBQ-C8-006",
    "CBQ-C8-041",
    "CBQ-C8-045",
}


def normalize(text):
    text = str(text or "").casefold()

    text = (
        text
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
        .replace("—", "-")
    )

    text = re.sub(
        r"[^a-z0-9]+",
        " ",
        text,
    )

    return " ".join(
        text.split()
    )


benchmark = []

with BENCHMARK.open(
    "r",
    encoding="utf-8-sig",
) as f:

    for line in f:

        line = line.strip()

        if line:

            row = json.loads(line)

            if row[
                "candidate_id"
            ] in BAD_IDS:

                benchmark.append(
                    row
                )


chunks = []

with EVAL_SOURCE.open(
    "r",
    encoding="utf-8-sig",
) as f:

    for line in f:

        line = line.strip()

        if line:

            chunks.append(
                json.loads(line)
            )


print()
print("=" * 90)
print("ACTUAL EVALUATION-SOURCE LOOKUP")
print("=" * 90)


for item in benchmark:

    print()
    print("=" * 90)

    print(
        item[
            "candidate_id"
        ],
        "| Class",
        item[
            "class_level"
        ],
    )

    print(
        "QUESTION:",
        item[
            "question"
        ],
    )

    print(
        "ANSWER:",
        item[
            "gold_answer"
        ],
    )

    print(
        "CURRENT CHUNK:",
        item[
            "chunk_id"
        ],
    )

    target_answer = normalize(
        item[
            "gold_answer"
        ]
    )

    target_question = normalize(
        item[
            "question"
        ]
    )


    matches = []

    for chunk in chunks:

        if int(
            chunk[
                "class_level"
            ]
        ) != int(
            item[
                "class_level"
            ]
        ):

            continue


        text_norm = normalize(
            chunk[
                "text"
            ]
        )


        answer_match = (
            target_answer
            and target_answer
            in text_norm
        )


        # Also look for substantial question keywords.
        question_tokens = [
            token
            for token in target_question.split()
            if len(token) >= 5
        ]

        keyword_hits = sum(
            token in text_norm
            for token
            in question_tokens
        )


        if answer_match or keyword_hits >= 2:

            matches.append(
                (
                    answer_match,
                    keyword_hits,
                    chunk,
                )
            )


    matches.sort(
        key=lambda x: (
            x[0],
            x[1],
        ),
        reverse=True,
    )


    if not matches:

        print(
            "NO MATCH FOUND IN 50 EVALUATION CHUNKS"
        )

        continue


    print()
    print(
        "BEST SOURCE MATCHES:"
    )

    for answer_match, keyword_hits, chunk in matches[:5]:

        print()
        print(
            "Chunk:",
            chunk[
                "chunk_id"
            ],
            "| pages",
            chunk[
                "page_start"
            ],
            "-",
            chunk[
                "page_end"
            ],
            "| answer_match=",
            answer_match,
            "| keyword_hits=",
            keyword_hits,
        )

        text = chunk[
            "text"
        ]

        # Print compact context around the answer where possible.
        pos = normalize(
            text
        ).find(
            target_answer
        )

        if pos >= 0:

            print(
                text[:1200]
            )

        else:

            print(
                text[:900]
            )

