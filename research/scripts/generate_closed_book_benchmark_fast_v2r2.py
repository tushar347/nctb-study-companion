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

VERSION = "closed-book-benchmark-candidates-v2r2-fast"

EXPECTED_SOURCE_SHA256 = (
    "c12c3918044f75c1fd06a91c8cefcf7b2d7210c7ec5abe15e07b4d2206586d57"
)

TARGET_PER_CLASS = 50

# Normally ONE call per chunk.
# Only one retry is allowed when necessary.
MAX_ATTEMPTS_PER_CHUNK = 2

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

AUTHOR_MODEL = os.getenv(
    "BENCHMARK_AUTHOR_MODEL",
    "gemma3:latest",
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


def stable_hash(text):
    return hashlib.sha256(
        text.encode("utf-8")
    ).hexdigest()


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
        str(text),
    ).strip()


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
            return None

    return None


def find_exact_answer(
    source,
    answer,
):
    """
    Find answer in source case-insensitively
    while returning the ORIGINAL source text.
    """

    source = str(source)
    answer = normalize_spaces(answer)

    if not answer:
        return None

    match = re.search(
        re.escape(answer),
        source,
        flags=re.IGNORECASE,
    )

    if match:
        return (
            match.start(),
            match.end(),
            source[
                match.start():
                match.end()
            ],
        )

    return None


def extract_evidence(
    source,
    start,
    end,
):
    """
    Deterministically extract a short sentence
    around the answer from the actual textbook.
    """

    left_candidates = [
        source.rfind(".", 0, start),
        source.rfind("?", 0, start),
        source.rfind("!", 0, start),
        source.rfind("\n", 0, start),
    ]

    left = max(
        left_candidates
    )

    if left < 0:
        left = 0
    else:
        left += 1

    right_candidates = []

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
            right_candidates.append(
                position + 1
            )

    if right_candidates:
        right = min(
            right_candidates
        )
    else:
        right = min(
            len(source),
            end + 180,
        )

    evidence = normalize_spaces(
        source[left:right]
    )

    # If OCR sentence boundaries make it huge,
    # use a smaller exact context window.
    if len(evidence.split()) > 60:

        left = max(
            0,
            start - 120,
        )

        right = min(
            len(source),
            end + 160,
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


def validate_candidate(
    item,
    source_text,
    seen_questions,
):
    if not isinstance(item, dict):
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

    found = find_exact_answer(
        source_text,
        answer,
    )

    if not found:
        return None, "answer_not_in_source"

    start, end, exact_answer = found

    normalized_q = (
        normalize_question(
            question
        )
    )

    if normalized_q in seen_questions:
        return None, "duplicate"

    evidence = extract_evidence(
        source_text,
        start,
        end,
    )

    return {
        "question":
            question,

        # Preserve exact source spelling/case.
        "gold_answer":
            exact_answer,

        "evidence_quote":
            evidence,

    }, None


def make_prompt(
    record,
    needed,
    accepted_questions,
):
    # Ask for extra items because some will
    # be rejected automatically.
    request_count = min(
        8,
        max(
            needed + 3,
            6,
        )
    )

    avoid = ""

    if accepted_questions:
        avoid = (
            "\nDo not repeat these:\n"
            + "\n".join(
                "- " + q
                for q
                in accepted_questions
            )
        )

    return f"""
Create {request_count} candidate CLOSED-BOOK short-answer
questions using ONLY the textbook content below.

At evaluation time the student/model sees ONLY the question,
not this source text.

Rules:
- Every question must make sense without seeing the passage.
- Never say "according to the passage", "in the text",
  "from the passage", or similar wording.
- Ask useful textbook facts, meanings, events, concepts,
  relationships, or comprehension knowledge.
- Do not ask about page numbers, headings, exercise labels,
  formatting, images, tables, or classroom instructions.
- Do not ask opinions.
- Each answer must be unambiguous.
- gold_answer must contain only 1 to 12 words.
- IMPORTANT: gold_answer must appear VERBATIM somewhere
  in SOURCE TEXT.
- Do not provide explanations.
- Do not invent facts.

Return JSON only:

{{
  "questions": [
    {{
      "question": "...?",
      "gold_answer": "..."
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


actual_sha = sha256_file(
    SOURCE
)

if actual_sha != EXPECTED_SOURCE_SHA256:

    print(
        "ERROR: Source SHA256 mismatch."
    )

    print(
        "Expected:",
        EXPECTED_SOURCE_SHA256
    )

    print(
        "Actual:",
        actual_sha
    )

    sys.exit(1)


records = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig",
) as f:

    for line in f:

        line = line.strip()

        if line:
            records.append(
                json.loads(line)
            )


by_class = defaultdict(list)

for record in records:
    by_class[
        int(
            record[
                "class_level"
            ]
        )
    ].append(record)


# Determine target count per chunk so each
# class gets exactly 50 candidates.
targets = {}

for class_level in (
    6,
    7,
    8,
):

    class_records = (
        by_class[
            class_level
        ]
    )

    base = (
        TARGET_PER_CLASS
        // len(class_records)
    )

    remainder = (
        TARGET_PER_CLASS
        % len(class_records)
    )

    ranking = sorted(
        class_records,
        key=lambda r:
            stable_hash(
                r["chunk_id"]
            )
    )

    extra_ids = {
        row["chunk_id"]
        for row in
        ranking[:remainder]
    }

    for row in class_records:

        targets[
            row["chunk_id"]
        ] = (
            base
            + (
                1
                if row[
                    "chunk_id"
                ] in extra_ids
                else 0
            )
        )


print()
print("=" * 78)
print("FAST CLOSED-BOOK BENCHMARK GENERATION V2R2")
print("=" * 78)

print(
    "Author model:",
    AUTHOR_MODEL
)

print(
    "Source chunks:",
    len(records)
)

print(
    "Target:",
    "150 candidates"
)

print(
    "Calls:",
    "normally 50; max 100"
)

print()


candidates = []
seen_questions = set()
rejects = Counter()
incomplete = []


ordered = sorted(
    records,
    key=lambda r: (
        int(
            r[
                "class_level"
            ]
        ),
        r["chunk_id"],
    )
)


for number, record in enumerate(
    ordered,
    start=1,
):

    target = targets[
        record[
            "chunk_id"
        ]
    ]

    accepted = []

    print(
        f"[{number:02d}/50] "
        f"{record['chunk_id']} "
        f"target={target}"
    )

    for attempt in range(
        1,
        MAX_ATTEMPTS_PER_CHUNK + 1,
    ):

        needed = (
            target
            - len(accepted)
        )

        if needed <= 0:
            break

        prompt = make_prompt(
            record,
            needed,
            [
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
                    0.1,

                "seed":
                    (
                        7000
                        + number * 10
                        + attempt
                    ),

                # Much smaller than previous 1200.
                "num_predict":
                    650,
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
                "   ERROR:",
                exc
            )

            continue


        raw_text = (
            response.get(
                "message",
                {}
            ).get(
                "content",
                ""
            )
        )

        parsed = parse_json(
            raw_text
        )

        if not isinstance(
            parsed,
            dict,
        ):

            rejects[
                "invalid_json"
            ] += 1

            print(
                f"   attempt {attempt}: "
                "invalid JSON"
            )

            continue


        questions = parsed.get(
            "questions",
            []
        )

        if not isinstance(
            questions,
            list,
        ):

            rejects[
                "missing_questions"
            ] += 1

            continue


        added = 0

        for item in questions:

            clean, reason = (
                validate_candidate(
                    item,
                    record["text"],
                    seen_questions,
                )
            )

            if clean is None:

                rejects[
                    reason
                ] += 1

                continue


            nq = normalize_question(
                clean[
                    "question"
                ]
            )

            seen_questions.add(
                nq
            )

            accepted.append(
                clean
            )

            added += 1

            if len(
                accepted
            ) >= target:
                break


        print(
            f"   attempt {attempt}: "
            f"+{added} accepted "
            f"=> {len(accepted)}/{target}"
        )


    if len(accepted) < target:

        incomplete.append(
            {
                "chunk_id":
                    record[
                        "chunk_id"
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
                    AUTHOR_MODEL,

                "auto_validation":
                    "PASS",
            }
        )


# Stable ordering.
candidates.sort(
    key=lambda r: (
        r["class_level"],
        r["chunk_id"],
        normalize_question(
            r["question"]
        ),
    )
)


serial = Counter()

for item in candidates:

    level = item[
        "class_level"
    ]

    serial[
        level
    ] += 1

    item[
        "candidate_id"
    ] = (
        f"CBQ-C{level}-"
        f"{serial[level]:03d}"
    )


candidate_path = (
    OUT_DIR
    / "closed_book_eval_candidates_v2r2_fast.jsonl"
)


with candidate_path.open(
    "w",
    encoding="utf-8",
) as f:

    for item in candidates:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


review_path = (
    OUT_DIR
    / "closed_book_eval_human_review_v2r2_fast.csv"
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

    for item in candidates:

        row = {
            key: ""
            for key
            in fields
        }

        row.update(
            {
                key:
                    value

                for key, value
                in item.items()

                if key in row
            }
        )

        writer.writerow(
            row
        )


distribution = Counter(
    item["class_level"]
    for item
    in candidates
)


summary = {
    "version":
        VERSION,

    "author_model":
        AUTHOR_MODEL,

    "source_sha256":
        actual_sha,

    "generated":
        len(candidates),

    "class_distribution":
        {
            str(level):
                distribution[
                    level
                ]

            for level
            in (
                6,
                7,
                8,
            )
        },

    "incomplete_chunks":
        incomplete,

    "rejection_reasons":
        dict(
            rejects
        ),

    "candidate_sha256":
        sha256_file(
            candidate_path
        ),
}


summary_path = (
    REPORT_DIR
    / "closed_book_eval_candidates_v2r2_fast_summary.json"
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
print("FAST BENCHMARK GENERATION COMPLETE")
print("=" * 78)

print(
    "Generated:",
    len(candidates),
    "/ 150"
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

print(
    "Incomplete chunks:",
    len(incomplete)
)

print()

print(
    "Rejected candidate reasons:"
)

for reason, count in (
    rejects.most_common()
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
    "Review CSV:",
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
    "IMPORTANT: Candidates are not yet "
    "the final locked benchmark."
)
