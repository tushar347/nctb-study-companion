from __future__ import annotations

import hashlib
import json
import random
import re
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from difflib import SequenceMatcher

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r7.jsonl"
)

EVAL_CHUNKS = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)

OUT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r8.jsonl"
)

SPOT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_15_spot_check_v2r8.jsonl"
)

SUMMARY = (
    ROOT
    / "research"
    / "reports"
    / "v2"
    / "closed_book_eval_v2r8_summary.json"
)

OLLAMA_URL = "http://127.0.0.1:11434"
MODEL = "gemma3:latest"

# Known bad / duplicate items from the V2R7 spot-check.
REMOVE_IDS = {
    "CBQ-C6-048",  # duplicate festival question
    "CBQ-C6-022",  # bad answer/question alignment
    "CBQ-C6-050",  # bad answer/question alignment
    "CBQ-C6-039",  # vague answer
    "CBQ-C6-034",  # unusable answer
    "CBQ-C7-003",  # mismatched answer
    "CBQ-C8-004",  # why/answer mismatch
    "CBQ-C8-045",  # MCQ-fragment evidence
}

EXPECTED_SOURCE_SHA = None


def sha256_file(path):
    h = hashlib.sha256()

    with path.open("rb") as f:
        for block in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            h.update(block)

    return h.hexdigest()


def load_jsonl(path):
    rows = []

    with path.open(
        "r",
        encoding="utf-8-sig",
    ) as f:

        for line in f:

            line = line.strip()

            if line:
                rows.append(
                    json.loads(line)
                )

    return rows


def norm(text):
    return " ".join(
        re.sub(
            r"[^a-z0-9]+",
            " ",
            str(text or "").casefold(),
        ).split()
    )


def normalize_space(text):
    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()


def post_json(payload):
    request = urllib.request.Request(
        OLLAMA_URL + "/api/chat",
        data=json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8"),
        headers={
            "Content-Type": "application/json"
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=180,
    ) as response:

        return json.loads(
            response.read().decode("utf-8")
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


def find_answer_in_source(
    source,
    answer,
):
    source_lower = source.casefold()
    answer_clean = normalize_space(answer)

    start = source_lower.find(
        answer_clean.casefold()
    )

    if start >= 0:

        return (
            start,
            start + len(answer_clean),
            source[
                start:
                start + len(answer_clean)
            ],
        )

    # Normalized-token fallback.
    source_tokens = list(
        re.finditer(
            r"\S+",
            source,
        )
    )

    answer_tokens = [
        norm(token)
        for token
        in answer_clean.split()
        if norm(token)
    ]

    if not answer_tokens:
        return None

    normalized_source_tokens = [
        norm(match.group(0))
        for match
        in source_tokens
    ]

    n = len(answer_tokens)

    for i in range(
        0,
        len(normalized_source_tokens) - n + 1,
    ):

        if (
            normalized_source_tokens[
                i:i+n
            ]
            == answer_tokens
        ):

            start = source_tokens[i].start()
            end = source_tokens[i+n-1].end()

            return (
                start,
                end,
                source[start:end],
            )

    return None


def evidence_from_source(
    source,
    start,
    end,
):
    left = max(
        source.rfind(".", 0, start),
        source.rfind("?", 0, start),
        source.rfind("!", 0, start),
        source.rfind("\n", 0, start),
    )

    if left < 0:
        left = 0
    else:
        left += 1

    rights = []

    for marker in (
        ".",
        "?",
        "!",
        "\n",
    ):
        pos = source.find(
            marker,
            end,
        )

        if pos >= 0:
            rights.append(
                pos + 1
            )

    if rights:
        right = min(rights)
    else:
        right = min(
            len(source),
            end + 200,
        )

    return normalize_space(
        source[left:right]
    )


def ask_gemma(
    source_record,
    rejected_question,
):
    prompt = f"""
Create ONE replacement CLOSED-BOOK short-answer benchmark
question from the textbook source below.

The previous question was rejected:
{rejected_question}

The new question MUST:
- be completely understandable without the passage;
- ask a real textbook fact or concept;
- have one clear short answer;
- not depend on "he", "she", "they", or "it" unless the
  question itself identifies the person/object;
- not ask about page numbers, headings, formatting, or exercise labels;
- not use multiple-choice distractors as facts;
- have a gold answer of 1-12 words;
- have a gold answer copied EXACTLY from the source;
- not repeat the rejected question.

Return JSON only:

{{
  "question": "...?",
  "gold_answer": "exact source words"
}}

SOURCE:
{source_record["text"]}
""".strip()

    payload = {
        "model": MODEL,
        "stream": False,
        "format": "json",
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ],
        "options": {
            "temperature": 0.08,
            "num_predict": 300,
        },
    }

    response = post_json(
        payload
    )

    return parse_json(
        response.get(
            "message",
            {}
        ).get(
            "content",
            ""
        )
    )


# ------------------------------------------------------
# Load current V2R7.
# ------------------------------------------------------

v2r7 = load_jsonl(
    SOURCE
)

chunks = load_jsonl(
    EVAL_CHUNKS
)

chunk_by_id = {
    row["chunk_id"]: row
    for row in chunks
}

print()
print("=" * 78)
print("V2R8 CONSOLIDATED BENCHMARK REPAIR")
print("=" * 78)

print(
    "V2R7 questions:",
    len(v2r7)
)

print(
    "Removing:",
    len(REMOVE_IDS)
)

# ------------------------------------------------------
# Keep all safe questions.
# ------------------------------------------------------

kept = [
    item
    for item in v2r7
    if item[
        "candidate_id"
    ] not in REMOVE_IDS
]


# ------------------------------------------------------
# Generate exactly one replacement for every removed item.
# ------------------------------------------------------

replacements = []

for old_item in v2r7:

    old_id = old_item[
        "candidate_id"
    ]

    if old_id not in REMOVE_IDS:
        continue

    source_record = chunk_by_id.get(
        old_item["chunk_id"]
    )

    if not source_record:
        raise SystemExit(
            f"Missing evaluation chunk: "
            f"{old_item['chunk_id']}"
        )

    print()
    print(
        "Replacing:",
        old_id
    )

    accepted = None

    # Maximum 2 short attempts.
    for attempt in range(
        1,
        3,
    ):

        try:
            generated = ask_gemma(
                source_record,
                old_item[
                    "question"
                ],
            )
        except Exception as exc:
            print(
                "  attempt",
                attempt,
                "error:",
                exc
            )
            continue

        if not isinstance(
            generated,
            dict,
        ):
            print(
                "  attempt",
                attempt,
                "invalid JSON"
            )
            continue

        question = normalize_space(
            generated.get(
                "question",
                ""
            )
        )

        answer = normalize_space(
            generated.get(
                "gold_answer",
                ""
            )
        )

        if (
            not question.endswith("?")
            or len(question) < 15
            or len(question) > 220
        ):
            print(
                "  attempt",
                attempt,
                "bad question"
            )
            continue

        if (
            not answer
            or len(answer.split()) > 12
        ):
            print(
                "  attempt",
                attempt,
                "bad answer"
            )
            continue

        if (
            norm(question)
            == norm(
                old_item[
                    "question"
                ]
            )
        ):
            continue

        forbidden = [
            "according to the passage",
            "according to the text",
            "in the passage",
            "from the passage",
            "the passage",
        ]

        if any(
            phrase in question.casefold()
            for phrase in forbidden
        ):
            continue

        span = find_answer_in_source(
            source_record["text"],
            answer,
        )

        if not span:
            print(
                "  attempt",
                attempt,
                "answer not grounded"
            )
            continue

        start, end, exact_answer = span

        evidence = evidence_from_source(
            source_record["text"],
            start,
            end,
        )

        accepted = {
            "class_level":
                int(
                    old_item[
                        "class_level"
                    ]
                ),

            "book_id":
                old_item[
                    "book_id"
                ],

            "chunk_id":
                old_item[
                    "chunk_id"
                ],

            "page_start":
                old_item[
                    "page_start"
                ],

            "page_end":
                old_item[
                    "page_end"
                ],

            "question":
                question,

            "gold_answer":
                exact_answer,

            "evidence_quote":
                evidence,

            "author_model":
                MODEL,

            "auto_validation":
                "PASS",

            "human_review_action":
                "REPLACEMENT_FROM_V2R8",
        }

        print(
            "  accepted:",
            question
        )

        print(
            "  answer:",
            exact_answer
        )

        break

    if accepted is None:
        raise SystemExit(
            f"FAILED to generate a safe replacement "
            f"for {old_id}. "
            f"V2R7 remains untouched."
        )

    replacements.append(
        accepted
    )


# ------------------------------------------------------
# Add replacements.
# ------------------------------------------------------

kept.extend(
    replacements
)


# ------------------------------------------------------
# Check class balance.
# ------------------------------------------------------

counts = Counter(
    int(
        item[
            "class_level"
        ]
    )
    for item in kept
)

if (
    len(kept) != 150
    or counts[6] != 50
    or counts[7] != 50
    or counts[8] != 50
):
    raise SystemExit(
        "STOP: V2R8 class balance failed: "
        + repr(
            dict(counts)
        )
    )


# ------------------------------------------------------
# Check exact duplicate questions.
# ------------------------------------------------------

question_map = defaultdict(list)

for item in kept:
    question_map[
        norm(
            item[
                "question"
            ]
        )
    ].append(
        item
    )

duplicate_questions = [
    ids
    for ids in question_map.values()
    if len(ids) > 1
]

if duplicate_questions:
    raise SystemExit(
        "STOP: Duplicate questions remain."
    )


# ------------------------------------------------------
# Stable final IDs.
# ------------------------------------------------------

kept.sort(
    key=lambda item: (
        int(
            item[
                "class_level"
            ]
        ),
        item[
            "chunk_id"
        ],
        norm(
            item[
                "question"
            ]
        ),
    )
)

serial = Counter()

for item in kept:

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


with OUT.open(
    "w",
    encoding="utf-8",
) as f:

    for item in kept:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


# ------------------------------------------------------
# Create a fresh stratified spot check.
# ------------------------------------------------------

rng = random.Random(
    20260814
)

spot_items = []

for level in (
    6,
    7,
    8,
):

    group = [
        item
        for item in kept
        if int(
            item[
                "class_level"
            ]
        ) == level
    ]

    spot_items.extend(
        rng.sample(
            group,
            5
        )
    )


with SPOT.open(
    "w",
    encoding="utf-8"
) as f:

    for item in spot_items:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


# ------------------------------------------------------
# Summary.
# ------------------------------------------------------

summary_data = {
    "version":
        "closed-book-benchmark-v2r8",

    "previous_file":
        str(
            SOURCE.relative_to(
                ROOT
            )
        ),

    "previous_count":
        len(v2r7),

    "removed_count":
        len(REMOVE_IDS),

    "replacement_count":
        len(replacements),

    "final_count":
        len(kept),

    "class_distribution": {
        "6": counts[6],
        "7": counts[7],
        "8": counts[8],
    },

    "duplicate_question_groups":
        len(
            duplicate_questions
        ),

    "sha256":
        sha256_file(OUT),

    "spot_check_file":
        str(
            SPOT.relative_to(
                ROOT
            )
        ),
}

SUMMARY.write_text(
    json.dumps(
        summary_data,
        ensure_ascii=False,
        indent=2,
    )
    + "\n",
    encoding="utf-8"
)


print()
print("=" * 78)
print("V2R8 CREATED SUCCESSFULLY")
print("=" * 78)

print(
    "Total:",
    len(kept)
)

print(
    "Class 6:",
    counts[6]
)

print(
    "Class 7:",
    counts[7]
)

print(
    "Class 8:",
    counts[8]
)

print(
    "Replacements:",
    len(replacements)
)

print(
    "Duplicate question groups:",
    len(
        duplicate_questions
    )
)

print()

print(
    "SHA256:",
    sha256_file(OUT)
)

print()

print(
    "V2R8:",
    OUT.relative_to(ROOT)
)

print(
    "Spot check:",
    SPOT.relative_to(ROOT)
)

print(
    "Summary:",
    SUMMARY.relative_to(ROOT)
)

print()
print(
    "NEXT: run the V2R8 audit, then review the 15 displayed spot-check items."
)
