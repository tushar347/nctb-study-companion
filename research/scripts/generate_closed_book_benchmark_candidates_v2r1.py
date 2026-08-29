from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import sys
import urllib.error
import urllib.request
from collections import Counter, defaultdict
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

OUT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

VERSION = "closed-book-benchmark-candidates-v2r1"

EXPECTED_SOURCE_SHA256 = (
    "c12c3918044f75c1fd06a91c8cefcf7b2d7210c7ec5abe15e07b4d2206586d57"
)

TARGET_PER_CLASS = 50
MAX_ATTEMPTS_PER_CHUNK = 3

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

PREFERRED_MODELS = [
    "gemma3:latest",
    "gemma3",
    "qwen3:latest",
    "qwen3",
]


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for block in iter(
            lambda: handle.read(1024 * 1024),
            b"",
        ):
            digest.update(block)

    return digest.hexdigest()


def stable_hash(text):
    return hashlib.sha256(
        text.encode("utf-8")
    ).hexdigest()


def post_json(url, payload, timeout):
    data = json.dumps(
        payload,
        ensure_ascii=False,
    ).encode("utf-8")

    request = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=timeout,
    ) as response:
        return json.loads(
            response.read().decode("utf-8")
        )


def get_json(url, timeout):
    request = urllib.request.Request(
        url,
        method="GET",
    )

    with urllib.request.urlopen(
        request,
        timeout=timeout,
    ) as response:
        return json.loads(
            response.read().decode("utf-8")
        )


def detect_author_model():
    forced = os.getenv(
        "BENCHMARK_AUTHOR_MODEL"
    )

    if forced:
        return forced

    try:
        response = get_json(
            OLLAMA_BASE_URL + "/api/tags",
            30,
        )
    except Exception as exc:
        print()
        print("ERROR: Could not connect to Ollama.")
        print("URL:", OLLAMA_BASE_URL)
        print("Details:", exc)
        print()
        print("Start Ollama and run this script again.")
        sys.exit(1)

    installed = [
        item.get("name", "")
        for item in response.get(
            "models",
            [],
        )
        if item.get("name")
    ]

    if not installed:
        print("ERROR: No Ollama models are installed.")
        sys.exit(1)

    for preferred in PREFERRED_MODELS:
        if preferred in installed:
            return preferred

    for name in installed:
        if name.startswith("gemma3"):
            return name

    return installed[0]


def parse_json_object(text):
    text = str(text or "").strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if (
        start >= 0
        and end > start
    ):
        candidate = text[start:end + 1]

        try:
            return json.loads(candidate)
        except Exception:
            pass

    return None


def normalize_question(text):
    text = str(text).casefold()
    text = re.sub(
        r"[^a-z0-9]+",
        " ",
        text,
    )
    return " ".join(
        text.split()
    )


def normalized_contains(
    container,
    value,
):
    container = re.sub(
        r"\s+",
        " ",
        str(container)
    ).strip().casefold()

    value = re.sub(
        r"\s+",
        " ",
        str(value)
    ).strip().casefold()

    return (
        bool(value)
        and value in container
    )


FORBIDDEN_QUESTION_PHRASES = [
    "according to the passage",
    "according to the text",
    "in the passage",
    "in the text above",
    "from the passage",
    "from the text",
    "based on the passage",
    "based on the text",
    "this passage",
    "the passage",
    "the text above",
]


def validate_item(
    item,
    source_text,
    global_questions,
):
    errors = []

    if not isinstance(
        item,
        dict,
    ):
        return None, [
            "not_an_object"
        ]

    question = str(
        item.get(
            "question",
            ""
        )
    ).strip()

    answer = str(
        item.get(
            "gold_answer",
            ""
        )
    ).strip()

    evidence = str(
        item.get(
            "evidence_quote",
            ""
        )
    ).strip()

    if len(question) < 15:
        errors.append(
            "question_too_short"
        )

    if len(question) > 240:
        errors.append(
            "question_too_long"
        )

    if question and not question.endswith("?"):
        errors.append(
            "question_missing_question_mark"
        )

    question_lower = question.casefold()

    for phrase in FORBIDDEN_QUESTION_PHRASES:
        if phrase in question_lower:
            errors.append(
                "passage_dependent_wording"
            )
            break

    answer_words = answer.split()

    if not answer_words:
        errors.append(
            "empty_answer"
        )

    elif len(answer_words) > 12:
        errors.append(
            "answer_over_12_words"
        )

    if not evidence:
        errors.append(
            "empty_evidence"
        )

    elif evidence not in source_text:
        errors.append(
            "evidence_not_exact_substring"
        )

    if (
        answer
        and evidence
        and not normalized_contains(
            evidence,
            answer,
        )
    ):
        errors.append(
            "answer_not_found_in_evidence"
        )

    normalized = normalize_question(
        question
    )

    if normalized in global_questions:
        errors.append(
            "duplicate_question"
        )

    subjective = [
        "what do you think",
        "what is your opinion",
        "how do you feel",
        "do you agree",
        "would you like",
    ]

    if any(
        phrase in question_lower
        for phrase in subjective
    ):
        errors.append(
            "subjective_question"
        )

    if errors:
        return None, errors

    clean = {
        "question": question,
        "gold_answer": answer,
        "evidence_quote": evidence,
    }

    return clean, []


def build_prompt(
    record,
    requested_count,
    existing_questions,
):
    previous = ""

    if existing_questions:
        previous = (
            "\nDo not repeat these questions already accepted "
            "for this source:\n"
            + "\n".join(
                "- " + q
                for q in existing_questions
            )
            + "\n"
        )

    return f"""
You are helping author a human-reviewed academic benchmark for an
English textbook model.

Create exactly {requested_count} CLOSED-BOOK short-answer questions
from the textbook source below.

The benchmark will later show ONLY the question to evaluated models.
The source passage will NOT be shown at evaluation time.

Rules:

1. Every question must be self-contained.
2. Never write "according to the passage", "in the text",
   "from the passage", or similar wording.
3. Ask only facts, definitions, meanings, relationships, events,
   or concepts explicitly supported by the source.
4. Do not require an image, table, diagram, previous page,
   classroom activity, or personal opinion.
5. Each question must have one clear answer.
6. gold_answer must be concise: 1 to 12 words.
7. evidence_quote must be copied EXACTLY from the source.
8. gold_answer must appear within evidence_quote.
9. Avoid trivial questions about page numbers, headings,
   book titles, exercise labels, or formatting.
10. Questions should test useful textbook knowledge that a student
    could remember after studying the book.
11. Prefer a mix of factual recall, vocabulary/meaning,
    comprehension, and concept knowledge.
12. Do not invent information.

Return JSON only in this exact structure:

{{
  "questions": [
    {{
      "question": "...?",
      "gold_answer": "...",
      "evidence_quote": "exact source quotation"
    }}
  ]
}}

Book: {record["book_id"]}
Class: {record["class_level"]}
Source pages: {record["page_start"]}-{record["page_end"]}
Chunk ID: {record["chunk_id"]}
{previous}

SOURCE TEXT:
{record["text"]}
""".strip()


source_sha = sha256_file(
    SOURCE
)

if source_sha != EXPECTED_SOURCE_SHA256:
    print()
    print("ERROR: Evaluation-source SHA256 mismatch.")
    print("Expected:", EXPECTED_SOURCE_SHA256)
    print("Actual:  ", source_sha)
    print()
    print("Stopped to protect the benchmark split.")
    sys.exit(1)


records = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig",
) as handle:
    for line in handle:
        line = line.strip()

        if line:
            records.append(
                json.loads(line)
            )


if len(records) != 50:
    print(
        "ERROR: Expected 50 evaluation-source chunks, got",
        len(records),
    )
    sys.exit(1)


by_class = defaultdict(list)

for record in records:
    by_class[
        int(record["class_level"])
    ].append(record)


print()
print("=" * 78)
print("CLOSED-BOOK BENCHMARK CANDIDATE GENERATION")
print("=" * 78)

print(
    "Evaluation-source SHA256:",
    source_sha,
)

print(
    "Evaluation-source chunks:",
    len(records),
)

print()

for class_level in sorted(
    by_class
):
    print(
        f"Class {class_level}:",
        len(
            by_class[class_level]
        ),
        "source chunks",
    )


author_model = detect_author_model()

print()
print(
    "Benchmark author model:",
    author_model,
)

print(
    "Ollama:",
    OLLAMA_BASE_URL,
)

print()
print(
    "Target: 50 questions per class, 150 total."
)

print()


# Assign exactly 50 question slots to each class.
requested_by_chunk = {}

for class_level in (
    6,
    7,
    8,
):
    class_records = by_class[
        class_level
    ]

    count = len(
        class_records
    )

    base = (
        TARGET_PER_CLASS
        // count
    )

    remainder = (
        TARGET_PER_CLASS
        % count
    )

    extra_rank = sorted(
        class_records,
        key=lambda r:
            stable_hash(
                r["chunk_id"]
            )
    )

    extra_ids = {
        record["chunk_id"]
        for record
        in extra_rank[:remainder]
    }

    for record in class_records:
        requested_by_chunk[
            record["chunk_id"]
        ] = (
            base
            + (
                1
                if record[
                    "chunk_id"
                ] in extra_ids
                else 0
            )
        )


candidates = []
raw_logs = []
global_questions = set()
rejection_reasons = Counter()
incomplete_chunks = []


ordered_records = sorted(
    records,
    key=lambda r: (
        int(
            r["class_level"]
        ),
        r["chunk_id"],
    )
)


for position, record in enumerate(
    ordered_records,
    start=1,
):
    target = requested_by_chunk[
        record["chunk_id"]
    ]

    accepted = []

    print(
        f"[{position:02d}/{len(ordered_records)}] "
        f"{record['chunk_id']} "
        f"-> target {target}"
    )

    for attempt in range(
        1,
        MAX_ATTEMPTS_PER_CHUNK + 1,
    ):
        remaining = (
            target
            - len(accepted)
        )

        if remaining <= 0:
            break

        prompt = build_prompt(
            record,
            remaining,
            [
                item["question"]
                for item
                in accepted
            ],
        )

        payload = {
            "model": author_model,
            "stream": False,
            "format": "json",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Create rigorous textbook benchmark questions. "
                        "Return valid JSON only. "
                        "Never invent facts."
                    ),
                },
                {
                    "role": "user",
                    "content": prompt,
                },
            ],
            "options": {
                "temperature": 0.15,
                "seed": (
                    4200
                    + int(
                        record[
                            "class_level"
                        ]
                    )
                    * 100
                    + position
                    + attempt
                ),
                "num_predict": 1200,
            },
        }

        try:
            response = post_json(
                OLLAMA_BASE_URL
                + "/api/chat",
                payload,
                OLLAMA_TIMEOUT,
            )

        except Exception as exc:
            raw_logs.append(
                {
                    "chunk_id":
                        record[
                            "chunk_id"
                        ],

                    "attempt":
                        attempt,

                    "status":
                        "ollama_error",

                    "error":
                        repr(exc),
                }
            )

            print(
                "   Ollama error:",
                exc,
            )

            continue


        response_text = str(
            response.get(
                "message",
                {}
            ).get(
                "content",
                ""
            )
        )

        raw_logs.append(
            {
                "chunk_id":
                    record[
                        "chunk_id"
                    ],

                "attempt":
                    attempt,

                "status":
                    "response",

                "requested":
                    remaining,

                "response":
                    response_text,
            }
        )


        parsed = parse_json_object(
            response_text
        )

        if not isinstance(
            parsed,
            dict,
        ):
            rejection_reasons[
                "invalid_json_object"
            ] += 1

            print(
                "   Attempt",
                attempt,
                "-> invalid JSON",
            )

            continue


        items = parsed.get(
            "questions"
        )

        if not isinstance(
            items,
            list,
        ):
            rejection_reasons[
                "missing_questions_array"
            ] += 1

            print(
                "   Attempt",
                attempt,
                "-> missing questions array",
            )

            continue


        before_count = len(
            accepted
        )

        for item in items:
            clean, errors = (
                validate_item(
                    item,
                    record["text"],
                    global_questions,
                )
            )

            if errors:
                for error in errors:
                    rejection_reasons[
                        error
                    ] += 1
                continue

            normalized = (
                normalize_question(
                    clean[
                        "question"
                    ]
                )
            )

            global_questions.add(
                normalized
            )

            accepted.append(
                clean
            )

            if len(
                accepted
            ) >= target:
                break


        added = (
            len(accepted)
            - before_count
        )

        print(
            "   Attempt",
            attempt,
            "-> accepted",
            added,
            "| total",
            len(accepted),
            "/",
            target,
        )


    if len(
        accepted
    ) < target:
        incomplete_chunks.append(
            {
                "chunk_id":
                    record[
                        "chunk_id"
                    ],

                "class_level":
                    record[
                        "class_level"
                    ],

                "target":
                    target,

                "accepted":
                    len(
                        accepted
                    ),
            }
        )


    for item in accepted[:target]:
        candidates.append(
            {
                "benchmark_version":
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
                    item[
                        "question"
                    ],

                "gold_answer":
                    item[
                        "gold_answer"
                    ],

                "evidence_quote":
                    item[
                        "evidence_quote"
                    ],

                "author_model":
                    author_model,

                "source_text_sha256":
                    record[
                        "text_sha256"
                    ],

                "auto_validation":
                    "PASS",
            }
        )


# Stable ordering and IDs.
candidates.sort(
    key=lambda r: (
        r["class_level"],
        r["chunk_id"],
        normalize_question(
            r["question"]
        ),
    )
)


class_serials = Counter()

for candidate in candidates:
    class_level = candidate[
        "class_level"
    ]

    class_serials[
        class_level
    ] += 1

    candidate[
        "candidate_id"
    ] = (
        f"CBQ-C{class_level}-"
        f"{class_serials[class_level]:03d}"
    )


candidate_path = (
    OUT_DIR
    / "closed_book_eval_candidates_v2r1.jsonl"
)

with candidate_path.open(
    "w",
    encoding="utf-8",
) as handle:
    for candidate in candidates:
        handle.write(
            json.dumps(
                candidate,
                ensure_ascii=False,
            )
            + "\n"
        )


raw_path = (
    OUT_DIR
    / "closed_book_eval_generation_raw_v2r1.jsonl"
)

with raw_path.open(
    "w",
    encoding="utf-8",
) as handle:
    for row in raw_logs:
        handle.write(
            json.dumps(
                row,
                ensure_ascii=False,
            )
            + "\n"
        )


review_path = (
    OUT_DIR
    / "closed_book_eval_human_review_v2r1.csv"
)

review_fields = [
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
) as handle:
    writer = csv.DictWriter(
        handle,
        fieldnames=review_fields,
    )

    writer.writeheader()

    for candidate in candidates:
        row = {
            field: ""
            for field in review_fields
        }

        for key in candidate:
            if key in row:
                row[key] = candidate[key]

        writer.writerow(row)


distribution = Counter(
    candidate[
        "class_level"
    ]
    for candidate
    in candidates
)


summary = {
    "version":
        VERSION,

    "source_file":
        str(
            SOURCE.relative_to(
                ROOT
            )
        ),

    "source_sha256":
        source_sha,

    "author_model":
        author_model,

    "target_per_class":
        TARGET_PER_CLASS,

    "target_total":
        TARGET_PER_CLASS * 3,

    "generated_candidates":
        len(candidates),

    "class_distribution": {
        str(class_level):
            distribution[
                class_level
            ]
        for class_level
        in (
            6,
            7,
            8,
        )
    },

    "incomplete_chunks":
        incomplete_chunks,

    "auto_rejection_reasons":
        dict(
            rejection_reasons
        ),

    "candidate_file":
        str(
            candidate_path.relative_to(
                ROOT
            )
        ),

    "candidate_sha256":
        sha256_file(
            candidate_path
        ),

    "human_review_file":
        str(
            review_path.relative_to(
                ROOT
            )
        ),

    "important":
        (
            "These are benchmark candidates only. "
            "Do not use them for SFT. "
            "Do not treat them as the final locked benchmark "
            "until human review is complete."
        ),
}


summary_path = (
    REPORT_DIR
    / "closed_book_eval_candidates_v2r1_summary.json"
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
print("CLOSED-BOOK BENCHMARK CANDIDATES V2R1 CREATED")
print("=" * 78)

print(
    "Author model:",
    author_model,
)

print(
    "Generated candidates:",
    len(candidates),
    "/",
    TARGET_PER_CLASS * 3,
)

print()

for class_level in (
    6,
    7,
    8,
):
    print(
        f"Class {class_level}:",
        distribution[
            class_level
        ],
        "/",
        TARGET_PER_CLASS,
    )

print()

print(
    "Incomplete source chunks:",
    len(
        incomplete_chunks
    )
)

print(
    "Automatically rejected items:",
    sum(
        rejection_reasons.values()
    )
)

print()

if rejection_reasons:
    print("AUTO-REJECTION REASONS")

    for reason, count in (
        rejection_reasons.most_common()
    ):
        print(
            f"  {reason}: {count}"
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
    candidate_path.relative_to(
        ROOT
    )
)

print(
    "Human review CSV:",
    review_path.relative_to(
        ROOT
    )
)

print(
    "Raw generations:",
    raw_path.relative_to(
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
    "IMPORTANT: This is NOT the final locked benchmark yet."
)

print(
    "Human review must happen before benchmark locking."
)

print(
    "PASS: No SFT file was created or modified."
)
