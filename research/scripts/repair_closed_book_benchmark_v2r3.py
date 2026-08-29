from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

EXISTING = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r2_fast.jsonl"
)

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)

OUT_DIR = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
)

REPORT_DIR = (
    ROOT
    / "research"
    / "reports"
    / "v2"
)

VERSION = "closed-book-benchmark-candidates-v2r3-complete"

AUTHOR_MODEL = os.getenv(
    "BENCHMARK_AUTHOR_MODEL",
    "gemma3:latest",
)

OLLAMA_BASE_URL = os.getenv(
    "OLLAMA_BASE_URL",
    "http://127.0.0.1:11434",
).rstrip("/")

OLLAMA_TIMEOUT = int(
    os.getenv(
        "OLLAMA_REQUEST_TIMEOUT_MS",
        "180000",
    )
) / 1000

TARGET_PER_CLASS = 50

# Known deficits from v2r2 run.
PRIMARY_TARGETS = {
    "class6-english-chunk-0054": 1,
    "class7-english-chunk-0010": 1,
    "class8-english-chunk-0104": 2,
    "class8-english-chunk-0120": 2,
}


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as f:
        for block in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            digest.update(block)

    return digest.hexdigest()


def normalize_question(text):
    return " ".join(
        re.sub(
            r"[^a-z0-9]+",
            " ",
            str(text).casefold(),
        ).split()
    )


def normalize_spaces(text):
    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()


def normalize_token(token):
    token = token.casefold()

    token = (
        token
        .replace("’", "'")
        .replace("‘", "'")
        .replace("–", "-")
        .replace("—", "-")
    )

    token = re.sub(
        r"^[^a-z0-9]+|[^a-z0-9]+$",
        "",
        token,
    )

    return token


def post_json(url, payload):
    data = json.dumps(
        payload,
        ensure_ascii=False,
    ).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type":
                "application/json"
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=OLLAMA_TIMEOUT,
    ) as response:

        return json.loads(
            response.read().decode(
                "utf-8"
            )
        )


def parse_json(text):
    text = str(text or "").strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start >= 0 and end > start:
        try:
            return json.loads(
                text[start:end + 1]
            )
        except Exception:
            pass

    return None


def find_answer_span(source, answer):
    """
    Returns exact source span.

    First tries literal case-insensitive matching.
    Then tries token-normalized contiguous matching.
    """

    source = str(source)
    answer = normalize_spaces(answer)

    if not answer:
        return None

    direct = re.search(
        re.escape(answer),
        source,
        flags=re.IGNORECASE,
    )

    if direct:
        return (
            direct.start(),
            direct.end(),
            source[
                direct.start():
                direct.end()
            ],
        )

    answer_tokens = [
        normalize_token(token)
        for token in answer.split()
    ]

    answer_tokens = [
        token
        for token in answer_tokens
        if token
    ]

    if not answer_tokens:
        return None

    source_matches = list(
        re.finditer(
            r"\S+",
            source,
        )
    )

    source_tokens = [
        normalize_token(
            match.group(0)
        )
        for match in source_matches
    ]

    size = len(
        answer_tokens
    )

    for start_index in range(
        0,
        len(source_tokens)
        - size
        + 1,
    ):

        candidate = source_tokens[
            start_index:
            start_index + size
        ]

        if candidate != answer_tokens:
            continue

        first = source_matches[
            start_index
        ]

        last = source_matches[
            start_index + size - 1
        ]

        start = first.start()
        end = last.end()

        return (
            start,
            end,
            source[start:end],
        )

    return None


def extract_evidence(
    source,
    start,
    end,
):
    left_positions = [
        source.rfind(".", 0, start),
        source.rfind("?", 0, start),
        source.rfind("!", 0, start),
        source.rfind("\n", 0, start),
    ]

    left = max(
        left_positions
    )

    if left < 0:
        left = 0
    else:
        left += 1

    right_positions = []

    for marker in (
        ".",
        "?",
        "!",
        "\n",
    ):

        position = source.find(
            marker,
            end,
        )

        if position >= 0:
            right_positions.append(
                position + 1
            )

    if right_positions:
        right = min(
            right_positions
        )
    else:
        right = min(
            len(source),
            end + 200,
        )

    evidence = normalize_spaces(
        source[left:right]
    )

    if len(
        evidence.split()
    ) > 70:

        left = max(
            0,
            start - 120,
        )

        right = min(
            len(source),
            end + 180,
        )

        evidence = normalize_spaces(
            source[left:right]
        )

    return evidence


FORBIDDEN = [
    "according to the passage",
    "according to the text",
    "in the passage",
    "in the text",
    "from the passage",
    "from the text",
    "based on the passage",
    "based on the text",
    "the passage",
    "the text above",
]


def validate(
    item,
    source_text,
    seen_questions,
):
    if not isinstance(
        item,
        dict,
    ):
        return None, "not_object"

    question = normalize_spaces(
        item.get(
            "question",
            ""
        )
    )

    answer = normalize_spaces(
        item.get(
            "gold_answer",
            ""
        )
    )

    if len(question) < 15:
        return None, "question_too_short"

    if len(question) > 220:
        return None, "question_too_long"

    if not question.endswith("?"):
        return None, "missing_question_mark"

    lower = question.casefold()

    if any(
        phrase in lower
        for phrase in FORBIDDEN
    ):
        return None, "passage_dependent"

    if any(
        phrase in lower
        for phrase in (
            "what do you think",
            "what is your opinion",
            "do you agree",
            "how do you feel",
        )
    ):
        return None, "subjective"

    answer_words = answer.split()

    if not answer_words:
        return None, "empty_answer"

    if len(answer_words) > 12:
        return None, "answer_too_long"

    span = find_answer_span(
        source_text,
        answer,
    )

    if span is None:
        return None, "answer_not_in_source"

    normalized_q = (
        normalize_question(
            question
        )
    )

    if normalized_q in seen_questions:
        return None, "duplicate_question"

    start, end, exact_answer = span

    evidence = extract_evidence(
        source_text,
        start,
        end,
    )

    return {
        "question":
            question,

        "gold_answer":
            exact_answer,

        "evidence_quote":
            evidence,
    }, None


def build_prompt(
    record,
    needed,
    existing_questions,
):
    request_count = max(
        6,
        needed + 4,
    )

    avoid = ""

    if existing_questions:
        avoid = (
            "\nDo NOT repeat these existing questions:\n"
            + "\n".join(
                "- " + question
                for question
                in existing_questions
            )
        )

    return f"""
Generate {request_count} candidate CLOSED-BOOK short-answer
questions from the textbook source below.

Only {needed} new valid question(s) are required, so provide
several alternatives.

At evaluation time ONLY the question will be shown.
The source text will NOT be shown.

Rules:

1. Every question must be self-contained.
2. Never refer to a passage or text.
3. Ask a useful textbook fact, meaning, event, relationship,
   definition, or concept.
4. Do not ask about headings, page numbers, exercise labels,
   formatting, classroom instructions, images, or opinions.
5. Each question must have one unambiguous short answer.
6. gold_answer must contain 1-12 words.
7. CRITICAL: copy gold_answer EXACTLY from SOURCE TEXT.
8. Do not paraphrase or change the spelling of gold_answer.
9. Do not invent facts.

Return JSON only:

{{
  "questions": [
    {{
      "question": "...?",
      "gold_answer": "exact words copied from source"
    }}
  ]
}}

Book: {record["book_id"]}
Class: {record["class_level"]}
Pages: {record["page_start"]}-{record["page_end"]}

{avoid}

SOURCE TEXT:
{record["text"]}
""".strip()


# ---------------------------------------------------------------------
# Load existing 144 accepted candidates.
# ---------------------------------------------------------------------

existing = []

with EXISTING.open(
    "r",
    encoding="utf-8-sig",
) as f:

    for line in f:
        line = line.strip()

        if line:
            existing.append(
                json.loads(line)
            )


source_records = {}

with SOURCE.open(
    "r",
    encoding="utf-8-sig",
) as f:

    for line in f:
        line = line.strip()

        if not line:
            continue

        record = json.loads(line)

        source_records[
            record["chunk_id"]
        ] = record


seen_questions = {
    normalize_question(
        item["question"]
    )
    for item in existing
}


questions_by_chunk = defaultdict(
    list
)

for item in existing:
    questions_by_chunk[
        item["chunk_id"]
    ].append(
        item["question"]
    )


distribution = Counter(
    int(
        item["class_level"]
    )
    for item in existing
)


print()
print("=" * 78)
print("REPAIRING MISSING CLOSED-BOOK QUESTIONS")
print("=" * 78)

print(
    "Existing candidates:",
    len(existing)
)

print(
    "Class 6:",
    distribution[6]
)

print(
    "Class 7:",
    distribution[7]
)

print(
    "Class 8:",
    distribution[8]
)

print()


new_items = []
rejects = Counter()


for chunk_id, needed in (
    PRIMARY_TARGETS.items()
):

    record = source_records.get(
        chunk_id
    )

    if record is None:

        print(
            "Missing source chunk:",
            chunk_id
        )

        continue

    accepted = []

    print(
        chunk_id,
        "-> need",
        needed
    )

    for attempt in range(
        1,
        5,
    ):

        remaining = (
            needed
            - len(accepted)
        )

        if remaining <= 0:
            break

        prompt = build_prompt(
            record,
            remaining,
            questions_by_chunk[
                chunk_id
            ]
            + [
                item[
                    "question"
                ]
                for item
                in accepted
            ],
        )

        payload = {
            "model":
                AUTHOR_MODEL,

            "stream":
                False,

            "format":
                "json",

            "messages": [
                {
                    "role":
                        "user",

                    "content":
                        prompt,
                }
            ],

            "options": {
                "temperature":
                    0.08,

                "seed":
                    9000
                    + attempt,

                "num_predict":
                    750,
            },
        }

        try:

            response = post_json(
                OLLAMA_BASE_URL
                + "/api/chat",
                payload,
            )

        except Exception as exc:

            print(
                "  attempt",
                attempt,
                "ERROR:",
                exc
            )

            continue


        parsed = parse_json(
            response.get(
                "message",
                {}
            ).get(
                "content",
                ""
            )
        )


        if not isinstance(
            parsed,
            dict,
        ):

            rejects[
                "invalid_json"
            ] += 1

            continue


        items = parsed.get(
            "questions",
            []
        )

        if not isinstance(
            items,
            list,
        ):

            rejects[
                "missing_questions_array"
            ] += 1

            continue


        added = 0

        for item in items:

            clean, reason = validate(
                item,
                record["text"],
                seen_questions,
            )

            if clean is None:

                rejects[
                    reason
                ] += 1

                continue


            seen_questions.add(
                normalize_question(
                    clean[
                        "question"
                    ]
                )
            )

            accepted.append(
                clean
            )

            added += 1

            if len(
                accepted
            ) >= needed:
                break


        print(
            "  attempt",
            attempt,
            "-> +",
            added,
            "=>",
            len(accepted),
            "/",
            needed
        )


    for clean in accepted:

        new_items.append(
            {
                "version":
                    VERSION,

                "class_level":
                    int(
                        record[
                            "class_level"
                        ]
                    ),

                "book_id":
                    record[
                        "book_id"
                    ],

                "chunk_id":
                    record[
                        "chunk_id"
                    ],

                "page_start":
                    record[
                        "page_start"
                    ],

                "page_end":
                    record[
                        "page_end"
                    ],

                "question":
                    clean[
                        "question"
                    ],

                "gold_answer":
                    clean[
                        "gold_answer"
                    ],

                "evidence_quote":
                    clean[
                        "evidence_quote"
                    ],

                "author_model":
                    AUTHOR_MODEL,

                "auto_validation":
                    "PASS",

                "repair_generation":
                    True,
            }
        )


combined = (
    existing
    + new_items
)


# ---------------------------------------------------------------------
# Check whether exact target reached.
# ---------------------------------------------------------------------

distribution = Counter(
    int(
        item[
            "class_level"
        ]
    )
    for item in combined
)


combined.sort(
    key=lambda item: (
        int(
            item[
                "class_level"
            ]
        ),
        item[
            "chunk_id"
        ],
        normalize_question(
            item[
                "question"
            ]
        ),
    )
)


# Reassign stable IDs.
serial = Counter()

for item in combined:

    level = int(
        item[
            "class_level"
        ]
    )

    serial[
        level
    ] += 1

    item[
        "candidate_id"
    ] = (
        f"CBQ-C{level}-"
        f"{serial[level]:03d}"
    )


output_path = (
    OUT_DIR
    / "closed_book_eval_candidates_v2r3_complete.jsonl"
)


with output_path.open(
    "w",
    encoding="utf-8",
) as f:

    for item in combined:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


review_path = (
    OUT_DIR
    / "closed_book_eval_human_review_v2r3_complete.csv"
)


fields = [
    "candidate_id",
    "class_level",
    "book_id",
    "chunk_id",
    "page_start",
    "page_end",
    "question",
    "gold_answer",
    "evidence_quote",
    "author_model",
    "auto_validation",
    "human_decision",
    "edited_question",
    "edited_answer",
    "accepted_answer_2",
    "accepted_answer_3",
    "reviewer_notes",
]


with review_path.open(
    "w",
    encoding="utf-8-sig",
    newline="",
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=fields,
    )

    writer.writeheader()

    for item in combined:

        row = {
            field: ""
            for field in fields
        }

        for key, value in (
            item.items()
        ):

            if key in row:
                row[key] = value

        writer.writerow(
            row
        )


summary = {
    "version":
        VERSION,

    "previous_candidates":
        len(existing),

    "repair_candidates_added":
        len(new_items),

    "total_candidates":
        len(combined),

    "class_distribution": {
        "6":
            distribution[6],

        "7":
            distribution[7],

        "8":
            distribution[8],
    },

    "repair_rejection_reasons":
        dict(
            rejects
        ),

    "candidate_sha256":
        sha256_file(
            output_path
        ),

    "status":
        (
            "READY_FOR_HUMAN_REVIEW"
            if (
                distribution[6]
                == TARGET_PER_CLASS
                and distribution[7]
                == TARGET_PER_CLASS
                and distribution[8]
                == TARGET_PER_CLASS
            )
            else
            "INCOMPLETE"
        ),
}


summary_path = (
    REPORT_DIR
    / "closed_book_eval_candidates_v2r3_complete_summary.json"
)


summary_path.write_text(
    json.dumps(
        summary,
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8",
)


print()
print("=" * 78)
print("CLOSED-BOOK BENCHMARK REPAIR COMPLETE")
print("=" * 78)

print(
    "Previous:",
    len(existing)
)

print(
    "Added:",
    len(new_items)
)

print(
    "Total:",
    len(combined)
)

print()

print(
    "Class 6:",
    distribution[6],
    "/ 50"
)

print(
    "Class 7:",
    distribution[7],
    "/ 50"
)

print(
    "Class 8:",
    distribution[8],
    "/ 50"
)

print()

print(
    "Status:",
    summary[
        "status"
    ]
)

print()

print(
    "Repair rejection reasons:"
)

for reason, count in (
    rejects.most_common()
):

    print(
        " ",
        reason,
        ":",
        count
    )

print()

print(
    "Candidate SHA256:",
    summary[
        "candidate_sha256"
    ]
)

print()

print(
    "Candidates:",
    output_path.relative_to(
        ROOT
    )
)

print(
    "Human review:",
    review_path.relative_to(
        ROOT
    )
)

print(
    "Summary:",
    summary_path.relative_to(
        ROOT
    )
)

print()

print(
    "IMPORTANT: Still NOT the final benchmark."
)

print(
    "Next step is quality audit + human review before SHA locking."
)
