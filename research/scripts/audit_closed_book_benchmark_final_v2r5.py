from __future__ import annotations

import hashlib
import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

CANDIDATES = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r6.jsonl"
)

EVAL_SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)

SFT_SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_sft_source_chunks_v2r3.jsonl"
)

FULL_CORPUS = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "training_ready"
    / "nctb_english_classes_6_7_8_training_ready_v2r2.jsonl"
)

REPORT_DIR = (
    ROOT
    / "research"
    / "reports"
    / "v2"
)

EXPECTED_CANDIDATE_SHA256 = (
    "e33e52686b3a57a340ce802fb2efd45eb3ffae85b81e95866808c4af8a9bf924"
)

EXPECTED_EVAL_SOURCE_SHA256 = (
    "c12c3918044f75c1fd06a91c8cefcf7b2d7210c7ec5abe15e07b4d2206586d57"
)

VERSION = "closed-book-benchmark-final-audit-v2r5"


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for block in iter(
            lambda: handle.read(1024 * 1024),
            b"",
        ):
            digest.update(block)

    return digest.hexdigest()


def load_jsonl(path):
    rows = []

    with path.open(
        "r",
        encoding="utf-8-sig",
    ) as handle:

        for line in handle:

            line = line.strip()

            if line:
                rows.append(
                    json.loads(line)
                )

    return rows


def normalize_space(text):
    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()


def normalize_match(text):
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


def normalized_contains(container, value):
    container = normalize_match(
        container
    )

    value = normalize_match(
        value
    )

    return (
        bool(value)
        and value in container
    )


def normalized_question(text):
    return normalize_match(text)


candidate_sha = sha256_file(
    CANDIDATES
)

eval_source_sha = sha256_file(
    EVAL_SOURCE
)

print()
print("=" * 78)
print("FINAL V2R5 BENCHMARK PRE-FLIGHT")
print("=" * 78)

print(
    "Candidate SHA256:",
    candidate_sha
)

print(
    "Candidate SHA check:",
    (
        "PASS"
        if candidate_sha
        == EXPECTED_CANDIDATE_SHA256
        else "FAIL"
    )
)

print(
    "Eval-source SHA check:",
    (
        "PASS"
        if eval_source_sha
        == EXPECTED_EVAL_SOURCE_SHA256
        else "FAIL"
    )
)

if (
    candidate_sha
    != EXPECTED_CANDIDATE_SHA256
    or eval_source_sha
    != EXPECTED_EVAL_SOURCE_SHA256
):
    raise SystemExit(
        "STOP: SHA256 integrity failure."
    )


candidates = load_jsonl(
    CANDIDATES
)

eval_chunks = load_jsonl(
    EVAL_SOURCE
)

sft_chunks = load_jsonl(
    SFT_SOURCE
)

full_pages = load_jsonl(
    FULL_CORPUS
)


eval_by_id = {
    row["chunk_id"]: row
    for row in eval_chunks
}

eval_ids = set(
    eval_by_id
)

sft_ids = {
    row["chunk_id"]
    for row in sft_chunks
}

stage_b_overlap = (
    eval_ids
    & sft_ids
)


book_text = defaultdict(list)

for page in full_pages:

    book_text[
        page["book_id"]
    ].append(
        str(
            page.get(
                "text",
                ""
            )
        )
    )


book_text_normalized = {
    book:
        normalize_match(
            "\n".join(texts)
        )

    for book, texts
    in book_text.items()
}


FORBIDDEN = [
    "according to the passage",
    "according to the text",
    "according to the above",
    "in the passage",
    "in the text",
    "from the passage",
    "from the text",
    "based on the passage",
    "based on the text",
    "the passage",
    "the text above",
    "the above text",
]


AMBIGUOUS = [
    r"^what did he\b",
    r"^what did she\b",
    r"^what did they\b",
    r"^what does he\b",
    r"^what does she\b",
    r"^what does it\b",
    r"^why did he\b",
    r"^why did she\b",
    r"^why did they\b",
    r"^where did he\b",
    r"^where did she\b",
    r"^where did they\b",
    r"^who is he\b",
    r"^who is she\b",
    r"^what is this\b",
    r"^what are these\b",
    r"^what are those\b",
]


# ------------------------------------------------------
# Exact duplicate map
# ------------------------------------------------------

question_groups = defaultdict(list)

for item in candidates:

    question_groups[
        normalized_question(
            item["question"]
        )
    ].append(
        item["candidate_id"]
    )


# ------------------------------------------------------
# Near duplicates
# ------------------------------------------------------

near_duplicates = defaultdict(list)

for i in range(
    len(candidates)
):

    q1 = normalized_question(
        candidates[i]["question"]
    )

    for j in range(
        i + 1,
        len(candidates)
    ):

        q2 = normalized_question(
            candidates[j]["question"]
        )

        if not q1 or not q2:
            continue

        ratio = SequenceMatcher(
            None,
            q1,
            q2,
        ).ratio()

        if ratio >= 0.90:

            id1 = candidates[i][
                "candidate_id"
            ]

            id2 = candidates[j][
                "candidate_id"
            ]

            near_duplicates[
                id1
            ].append(
                (id2, ratio)
            )

            near_duplicates[
                id2
            ].append(
                (id1, ratio)
            )


status_counts = Counter()
hard_reasons = Counter()
review_reasons = Counter()

flagged = []


for item in candidates:

    cid = item[
        "candidate_id"
    ]

    question = normalize_space(
        item["question"]
    )

    answer = normalize_space(
        item["gold_answer"]
    )

    evidence = normalize_space(
        item["evidence_quote"]
    )

    chunk_id = item[
        "chunk_id"
    ]

    book_id = item[
        "book_id"
    ]


    hard = []
    review = []


    # --------------------------------------------------
    # Source membership
    # --------------------------------------------------

    if chunk_id not in eval_by_id:

        hard.append(
            "missing_eval_source_chunk"
        )

    else:

        source_text = eval_by_id[
            chunk_id
        ][
            "text"
        ]

        if not normalized_contains(
            source_text,
            answer,
        ):

            hard.append(
                "answer_not_grounded"
            )

        if not normalized_contains(
            evidence,
            answer,
        ):

            hard.append(
                "answer_not_in_evidence"
            )

        if not normalized_contains(
            source_text,
            evidence,
        ):

            review.append(
                "evidence_not_exact_after_normalization"
            )


    # --------------------------------------------------
    # Closed-book wording
    # --------------------------------------------------

    q_lower = question.casefold()

    if any(
        phrase in q_lower
        for phrase in FORBIDDEN
    ):

        hard.append(
            "passage_dependent_wording"
        )


    # --------------------------------------------------
    # Question structure
    # --------------------------------------------------

    if not question.endswith("?"):

        hard.append(
            "missing_question_mark"
        )


    if len(question) < 15:

        review.append(
            "question_too_short"
        )


    if len(question) > 220:

        review.append(
            "question_too_long"
        )


    for pattern in AMBIGUOUS:

        if re.search(
            pattern,
            q_lower,
        ):

            review.append(
                "possible_unresolved_reference"
            )

            break


    # --------------------------------------------------
    # Answer length
    # --------------------------------------------------

    answer_words = (
        answer.split()
    )

    if not answer_words:

        hard.append(
            "empty_answer"
        )

    elif len(answer_words) > 12:

        hard.append(
            "answer_over_12_words"
        )


    # --------------------------------------------------
    # Exact duplicate
    # --------------------------------------------------

    nq = normalized_question(
        question
    )

    if len(
        question_groups[
            nq
        ]
    ) > 1:

        hard.append(
            "exact_duplicate_question"
        )


    # --------------------------------------------------
    # Near duplicate
    # --------------------------------------------------

    if near_duplicates.get(
        cid
    ):

        review.append(
            "near_duplicate_question"
        )


    # --------------------------------------------------
    # Check whether benchmark question itself
    # was copied verbatim from textbook.
    # --------------------------------------------------

    normalized_q = normalize_match(
        question
    )

    if (
        len(
            normalized_q.split()
        ) >= 5
        and normalized_q
        in book_text_normalized[
            book_id
        ]
    ):

        review.append(
            "question_verbatim_in_textbook"
        )


    hard = sorted(
        set(hard)
    )

    review = sorted(
        set(review)
    )


    if hard:

        status = "HARD_FAIL"

    elif review:

        status = "REVIEW_REQUIRED"

    else:

        status = "AUTO_PASS"


    status_counts[
        status
    ] += 1


    for reason in hard:

        hard_reasons[
            reason
        ] += 1


    for reason in review:

        review_reasons[
            reason
        ] += 1


    if status != "AUTO_PASS":

        flagged.append(
            {
                "candidate_id":
                    cid,

                "class_level":
                    item[
                        "class_level"
                    ],

                "question":
                    question,

                "gold_answer":
                    answer,

                "status":
                    status,

                "hard_reasons":
                    hard,

                "review_reasons":
                    review,
            }
        )


distribution = Counter(
    int(
        item["class_level"]
    )
    for item in candidates
)


summary = {
    "version":
        VERSION,

    "candidate_sha256":
        candidate_sha,

    "candidate_count":
        len(candidates),

    "class_distribution": {
        "6":
            distribution[6],

        "7":
            distribution[7],

        "8":
            distribution[8],
    },

    "stage_b_source_overlap":
        len(
            stage_b_overlap
        ),

    "auto_status": {
        "AUTO_PASS":
            status_counts[
                "AUTO_PASS"
            ],

        "REVIEW_REQUIRED":
            status_counts[
                "REVIEW_REQUIRED"
            ],

        "HARD_FAIL":
            status_counts[
                "HARD_FAIL"
            ],
    },

    "hard_failure_reasons":
        dict(
            hard_reasons
        ),

    "review_reasons":
        dict(
            review_reasons
        ),

    "near_duplicate_pairs":
        sum(
            len(values)
            for values
            in near_duplicates.values()
        ) // 2,

    "flagged_items":
        flagged,
}


SUMMARY = (
    REPORT_DIR
    / "closed_book_eval_final_audit_v2r6_summary.json"
)


SUMMARY.write_text(
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
print("FINAL CLOSED-BOOK BENCHMARK AUDIT V2R5")
print("=" * 78)

print(
    "Candidates:",
    len(candidates)
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

print(
    "Stage-B source chunk overlap:",
    len(
        stage_b_overlap
    )
)

print()

print("AUTO STATUS")
print("-" * 78)

print(
    "AUTO_PASS:",
    status_counts[
        "AUTO_PASS"
    ]
)

print(
    "REVIEW_REQUIRED:",
    status_counts[
        "REVIEW_REQUIRED"
    ]
)

print(
    "HARD_FAIL:",
    status_counts[
        "HARD_FAIL"
    ]
)

print()

print("HARD FAILURE REASONS")
print("-" * 78)

if hard_reasons:

    for reason, count in (
        hard_reasons.most_common()
    ):

        print(
            f"{reason}: {count}"
        )

else:

    print("None")


print()
print("REVIEW REASONS")
print("-" * 78)

if review_reasons:

    for reason, count in (
        review_reasons.most_common()
    ):

        print(
            f"{reason}: {count}"
        )

else:

    print("None")


print()

print(
    "Near-duplicate pairs:",
    summary[
        "near_duplicate_pairs"
    ]
)

print()

if flagged:

    print("FLAGGED ITEMS")
    print("-" * 78)

    for item in flagged:

        print()
        print(
            item[
                "candidate_id"
            ],
            "|",
            item[
                "status"
            ]
        )

        print(
            "Question:",
            item[
                "question"
            ]
        )

        print(
            "Answer:",
            item[
                "gold_answer"
            ]
        )

        if item[
            "hard_reasons"
        ]:

            print(
                "Hard:",
                ", ".join(
                    item[
                        "hard_reasons"
                    ]
                )
            )

        if item[
            "review_reasons"
        ]:

            print(
                "Review:",
                ", ".join(
                    item[
                        "review_reasons"
                    ]
                )
            )


print()
print(
    "Candidate SHA256:",
    candidate_sha
)

print(
    "Summary:",
    SUMMARY.relative_to(
        ROOT
    )
)

print()

if (
    len(candidates) == 150
    and distribution[6] == 50
    and distribution[7] == 50
    and distribution[8] == 50
    and len(stage_b_overlap) == 0
    and status_counts["HARD_FAIL"] == 0
    and summary[
        "near_duplicate_pairs"
    ] == 0
):

    print(
        "AUTOMATIC INTEGRITY RESULT: PASS"
    )

else:

    print(
        "AUTOMATIC INTEGRITY RESULT: REVIEW/FAIL"
    )

print()
print(
    "NOTE: Automatic PASS does not replace "
    "the final human benchmark approval."
)


