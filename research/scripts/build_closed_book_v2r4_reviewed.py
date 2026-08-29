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

CANDIDATES = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r3_complete.jsonl"
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

EXPECTED_SHA = (
    "7b7636c670b86a9525c2db0f10733c8557f652742d042135474629d466d6bfa6"
)

VERSION = "closed-book-benchmark-candidates-v2r4-reviewed"

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


# -------------------------------------------------------
# Human decisions for the 8 priority-review questions.
# -------------------------------------------------------

EDIT_QUESTIONS = {

    "CBQ-C6-015":
        (
            "What were Benu and her roommate doing when "
            "the narrator met them again at the bus station?"
        ),

    "CBQ-C7-007":
        'Who wrote the section titled "America at Play"?',

    "CBQ-C7-016":
        (
            "What does a person with a clear conscience "
            "usually do?"
        ),

    "CBQ-C8-045":
        (
            "By what method was folk music traditionally "
            "passed from one generation to another?"
        ),
}


REJECT_IDS = {
    "CBQ-C6-020",
    "CBQ-C6-043",
    "CBQ-C6-045",
    "CBQ-C8-009",
}


# These source chunks caused the rejected questions.
# We do not use them for replacements.
BAD_SOURCE_CHUNKS = {
    "class6-english-chunk-0026",
    "class6-english-chunk-0054",
    "class8-english-chunk-0029",
}


REPLACEMENTS_NEEDED = {
    6: 3,
    7: 0,
    8: 1,
}


def sha256_file(path):

    digest = hashlib.sha256()

    with path.open("rb") as f:

        for block in iter(
            lambda: f.read(
                1024 * 1024
            ),
            b"",
        ):
            digest.update(block)

    return digest.hexdigest()


def normalize_space(text):

    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()


def normalize_question(text):

    return " ".join(
        re.sub(
            r"[^a-z0-9]+",
            " ",
            str(text or "").casefold(),
        ).split()
    )


def normalize_token(token):

    token = token.casefold()

    token = (
        token
        .replace("’", "'")
        .replace("‘", "'")
        .replace("–", "-")
        .replace("—", "-")
    )

    return re.sub(
        r"^[^a-z0-9]+|[^a-z0-9]+$",
        "",
        token,
    )


def post_json(url, payload):

    request = urllib.request.Request(
        url,
        data=json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8"),
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


def find_answer_span(
    source,
    answer,
):

    source = str(source)

    answer = normalize_space(
        answer
    )

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


    matches = list(
        re.finditer(
            r"\S+",
            source
        )
    )

    source_tokens = [
        normalize_token(
            match.group(0)
        )
        for match in matches
    ]


    size = len(
        answer_tokens
    )

    for start_index in range(
        len(source_tokens)
        - size
        + 1
    ):

        if (
            source_tokens[
                start_index:
                start_index + size
            ]
            == answer_tokens
        ):

            first = matches[
                start_index
            ]

            last = matches[
                start_index
                + size
                - 1
            ]

            return (
                first.start(),
                last.end(),
                source[
                    first.start():
                    last.end()
                ],
            )

    return None


def evidence_context(
    source,
    start,
    end,
):

    left = max(
        source.rfind(
            ".",
            0,
            start
        ),
        source.rfind(
            "?",
            0,
            start
        ),
        source.rfind(
            "!",
            0,
            start
        ),
        source.rfind(
            "\n",
            0,
            start
        ),
    )

    left = (
        0
        if left < 0
        else left + 1
    )


    right_positions = []

    for marker in (
        ".",
        "?",
        "!",
        "\n",
    ):

        position = source.find(
            marker,
            end
        )

        if position >= 0:

            right_positions.append(
                position + 1
            )


    right = (
        min(right_positions)
        if right_positions
        else min(
            len(source),
            end + 180
        )
    )

    return normalize_space(
        source[left:right]
    )


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
    source,
    seen,
):

    if not isinstance(
        item,
        dict
    ):
        return None


    question = normalize_space(
        item.get(
            "question",
            ""
        )
    )

    answer = normalize_space(
        item.get(
            "gold_answer",
            ""
        )
    )


    if (
        len(question) < 15
        or len(question) > 220
        or not question.endswith("?")
    ):
        return None


    lower = question.casefold()

    if any(
        phrase in lower
        for phrase in FORBIDDEN
    ):
        return None


    if any(
        phrase in lower
        for phrase in (
            "what do you think",
            "what is your opinion",
            "do you agree",
            "how do you feel",
        )
    ):
        return None


    if not answer:
        return None


    if len(
        answer.split()
    ) > 12:
        return None


    normalized_q = (
        normalize_question(
            question
        )
    )

    if normalized_q in seen:
        return None


    span = find_answer_span(
        source,
        answer
    )

    if span is None:
        return None


    start, end, exact = span

    return {
        "question":
            question,

        "gold_answer":
            exact,

        "evidence_quote":
            evidence_context(
                source,
                start,
                end
            ),
    }


def source_quality(record):

    text = str(
        record.get(
            "text",
            ""
        )
    )

    if (
        record["chunk_id"]
        in BAD_SOURCE_CHUNKS
    ):
        return -999


    lower = text.casefold()

    # Avoid exercise-heavy chunks because MCQ
    # options may contain deliberately false facts.
    penalty = 0

    exercise_markers = [
        "which of the following",
        "multiple choice",
        "match the words",
        "true or false",
        "choose the best answer",
        "complete the following",
    ]

    for marker in exercise_markers:

        if marker in lower:
            penalty += 100


    visible = [
        ch
        for ch in text
        if not ch.isspace()
    ]

    alpha_ratio = (
        sum(
            ch.isalpha()
            for ch in visible
        )
        / max(
            1,
            len(visible)
        )
    )


    return (
        alpha_ratio * 1000
        + min(
            int(
                record[
                    "word_count"
                ]
            ),
            400
        )
        - penalty
    )


def prompt_for(
    record,
    needed,
    existing_questions,
):

    return f"""
Create 8 candidate CLOSED-BOOK short-answer questions
from the textbook source below.

We need {needed} strong replacement question(s).

The evaluated model will see ONLY the question.

Rules:

- Every question must be self-contained.
- Never refer to "the passage" or "the text".
- Prefer meaningful textbook knowledge.
- Ask facts, concepts, meanings, events, relationships,
  causes, or consequences explicitly stated in the source.
- Avoid exercise instructions, page numbers, headings,
  author metadata, formatting, and classroom activities.
- IMPORTANT: if the source contains multiple-choice
  questions, DO NOT infer that an option is correct.
- Do not use information that appears only as an
  unverified MCQ option.
- Avoid opinions.
- Answer must contain 1-12 words.
- gold_answer MUST be copied verbatim from source text.
- Do not paraphrase the gold answer.
- Do not invent information.

Do not repeat any of these benchmark questions:

{chr(10).join("- " + q for q in existing_questions)}

Return JSON only:

{{
  "questions": [
    {{
      "question": "...?",
      "gold_answer": "exact source words"
    }}
  ]
}}

Class: {record["class_level"]}
Book: {record["book_id"]}
Pages: {record["page_start"]}-{record["page_end"]}

SOURCE:
{record["text"]}
""".strip()


actual_sha = sha256_file(
    CANDIDATES
)

if actual_sha != EXPECTED_SHA:

    print(
        "ERROR: v2r3 candidate SHA mismatch."
    )

    print(
        "Expected:",
        EXPECTED_SHA
    )

    print(
        "Actual:",
        actual_sha
    )

    sys.exit(1)


candidates = []

with CANDIDATES.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:

        line = line.strip()

        if line:
            candidates.append(
                json.loads(line)
            )


sources = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:

        line = line.strip()

        if line:
            sources.append(
                json.loads(line)
            )


# -------------------------------------------------------
# Apply the four human edits and remove four rejects.
# -------------------------------------------------------

working = []

for item in candidates:

    cid = item[
        "candidate_id"
    ]


    if cid in REJECT_IDS:
        continue


    updated = dict(
        item
    )


    if cid in EDIT_QUESTIONS:

        updated[
            "question"
        ] = EDIT_QUESTIONS[
            cid
        ]

        updated[
            "human_review_action"
        ] = "EDIT"

    else:

        updated[
            "human_review_action"
        ] = "UNCHANGED"


    working.append(
        updated
    )


seen = {
    normalize_question(
        item[
            "question"
        ]
    )
    for item in working
}


replacement_records = []


print()
print("=" * 78)
print("BUILDING V2R4 REVIEWED BENCHMARK CANDIDATES")
print("=" * 78)

print(
    "v2r3 questions:",
    len(candidates)
)

print(
    "Human edits:",
    len(
        EDIT_QUESTIONS
    )
)

print(
    "Rejected:",
    len(
        REJECT_IDS
    )
)

print()


for class_level in (
    6,
    8,
):

    needed = REPLACEMENTS_NEEDED[
        class_level
    ]

    if needed <= 0:
        continue


    class_sources = [
        row
        for row in sources
        if int(
            row[
                "class_level"
            ]
        ) == class_level
    ]


    class_sources.sort(
        key=source_quality,
        reverse=True
    )


    print(
        f"Class {class_level}: "
        f"need {needed} replacements"
    )


    accepted = []


    for source_record in class_sources:

        if len(
            accepted
        ) >= needed:
            break


        if source_quality(
            source_record
        ) < 0:
            continue


        existing_questions = [
            item[
                "question"
            ]
            for item in (
                working
                + replacement_records
                + accepted
            )
        ]


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
                        prompt_for(
                            source_record,
                            needed
                            - len(
                                accepted
                            ),
                            existing_questions,
                        ),
                }
            ],

            "options": {
                "temperature":
                    0.08,

                "seed":
                    (
                        12000
                        + class_level
                        + len(
                            accepted
                        )
                    ),

                "num_predict":
                    800,
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
                "  Ollama error:",
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
            dict
        ):
            continue


        items = parsed.get(
            "questions",
            []
        )


        for generated in items:

            clean = validate(
                generated,
                source_record[
                    "text"
                ],
                seen,
            )


            if clean is None:
                continue


            seen.add(
                normalize_question(
                    clean[
                        "question"
                    ]
                )
            )


            new_item = {
                "version":
                    VERSION,

                "class_level":
                    class_level,

                "book_id":
                    source_record[
                        "book_id"
                    ],

                "chunk_id":
                    source_record[
                        "chunk_id"
                    ],

                "page_start":
                    source_record[
                        "page_start"
                    ],

                "page_end":
                    source_record[
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

                "human_review_action":
                    "REPLACEMENT_CANDIDATE",
            }


            accepted.append(
                new_item
            )


            print(
                "  +",
                clean[
                    "question"
                ]
            )


            if len(
                accepted
            ) >= needed:
                break


    if len(
        accepted
    ) != needed:

        print()

        print(
            "ERROR: Could only create",
            len(accepted),
            "of",
            needed,
            "replacement questions for Class",
            class_level
        )

        sys.exit(1)


    replacement_records.extend(
        accepted
    )


combined = (
    working
    + replacement_records
)


distribution = Counter(
    int(
        item[
            "class_level"
        ]
    )
    for item in combined
)


if (
    len(combined) != 150
    or distribution[6] != 50
    or distribution[7] != 50
    or distribution[8] != 50
):

    print(
        "ERROR: Final distribution incorrect."
    )

    print(
        len(combined),
        dict(distribution)
    )

    sys.exit(1)


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


serials = Counter()

for item in combined:

    level = int(
        item[
            "class_level"
        ]
    )

    serials[
        level
    ] += 1

    item[
        "candidate_id"
    ] = (
        f"CBQ-C{level}-"
        f"{serials[level]:03d}"
    )


OUTPUT = (
    OUT_DIR
    / "closed_book_eval_candidates_v2r4_reviewed.jsonl"
)


with OUTPUT.open(
    "w",
    encoding="utf-8"
) as f:

    for item in combined:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False
            )
            + "\n"
        )


REVIEW = (
    OUT_DIR
    / "closed_book_eval_human_review_v2r4.csv"
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
    "human_review_action",
    "final_decision",
    "reviewer_notes",
]


with REVIEW.open(
    "w",
    encoding="utf-8-sig",
    newline=""
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=fields,
    )

    writer.writeheader()


    for item in combined:

        row = {
            key: ""
            for key in fields
        }

        for key in fields:

            if key in item:
                row[key] = item[
                    key
                ]

        writer.writerow(
            row
        )


summary = {
    "version":
        VERSION,

    "source_candidate_sha256":
        actual_sha,

    "total":
        len(combined),

    "class_distribution": {
        "6":
            distribution[6],

        "7":
            distribution[7],

        "8":
            distribution[8],
    },

    "human_edits":
        sorted(
            EDIT_QUESTIONS
        ),

    "rejected_candidate_ids":
        sorted(
            REJECT_IDS
        ),

    "replacement_count":
        len(
            replacement_records
        ),

    "output_sha256":
        sha256_file(
            OUTPUT
        ),
}


SUMMARY = (
    REPORT_DIR
    / "closed_book_eval_candidates_v2r4_reviewed_summary.json"
)


SUMMARY.write_text(
    json.dumps(
        summary,
        ensure_ascii=False,
        indent=2
    )
    + "\n",
    encoding="utf-8"
)


print()
print("=" * 78)
print("V2R4 REVIEWED CANDIDATES CREATED")
print("=" * 78)

print(
    "Total:",
    len(combined)
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
    "Human edits:",
    len(
        EDIT_QUESTIONS
    )
)

print(
    "Rejected + replaced:",
    len(
        REJECT_IDS
    )
)

print()

print(
    "SHA256:",
    summary[
        "output_sha256"
    ]
)

print()

print(
    "Candidates:",
    OUTPUT.relative_to(
        ROOT
    )
)

print(
    "Final review CSV:",
    REVIEW.relative_to(
        ROOT
    )
)

print(
    "Summary:",
    SUMMARY.relative_to(
        ROOT
    )
)

print()
print(
    "IMPORTANT: Do not lock yet."
)

print(
    "Run the quality audit again on v2r4 first."
)
