from __future__ import annotations

import csv
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
    / "closed_book_eval_candidates_v2r3_complete.jsonl"
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

EVAL_DIR = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
)

REPORT_DIR.mkdir(parents=True, exist_ok=True)
EVAL_DIR.mkdir(parents=True, exist_ok=True)

EXPECTED_CANDIDATE_SHA256 = (
    "7b7636c670b86a9525c2db0f10733c8557f652742d042135474629d466d6bfa6"
)

EXPECTED_EVAL_SOURCE_SHA256 = (
    "c12c3918044f75c1fd06a91c8cefcf7b2d7210c7ec5abe15e07b4d2206586d57"
)

VERSION = "closed-book-benchmark-quality-audit-v2r3"


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
    records = []

    with path.open(
        "r",
        encoding="utf-8-sig",
    ) as handle:

        for line in handle:
            line = line.strip()

            if line:
                records.append(
                    json.loads(line)
                )

    return records


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


def normalize_for_match(text):
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
    container = normalize_for_match(
        container
    )

    value = normalize_for_match(
        value
    )

    return (
        bool(value)
        and value in container
    )


candidate_sha = sha256_file(
    CANDIDATES
)

eval_sha = sha256_file(
    EVAL_SOURCE
)

print()
print("=" * 78)
print("PRE-FLIGHT INTEGRITY CHECK")
print("=" * 78)

print(
    "Candidate SHA256:",
    candidate_sha
)

print(
    "Expected:",
    EXPECTED_CANDIDATE_SHA256
)

print(
    "Candidate lock:",
    (
        "PASS"
        if candidate_sha
        == EXPECTED_CANDIDATE_SHA256
        else "FAIL"
    )
)

print()

print(
    "Eval-source SHA256:",
    eval_sha
)

print(
    "Expected:",
    EXPECTED_EVAL_SOURCE_SHA256
)

print(
    "Eval-source lock:",
    (
        "PASS"
        if eval_sha
        == EXPECTED_EVAL_SOURCE_SHA256
        else "FAIL"
    )
)

if (
    candidate_sha
    != EXPECTED_CANDIDATE_SHA256
    or eval_sha
    != EXPECTED_EVAL_SOURCE_SHA256
):
    raise SystemExit(
        "STOPPED: SHA256 integrity check failed."
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


# Critical Stage-B leakage check.
chunk_overlap = (
    eval_ids
    & sft_ids
)


full_book_text = defaultdict(list)

for row in full_pages:
    full_book_text[
        row["book_id"]
    ].append(
        str(
            row.get(
                "text",
                ""
            )
        )
    )


full_book_normalized = {
    book_id:
        normalize_for_match(
            "\n".join(texts)
        )

    for book_id, texts
    in full_book_text.items()
}


FORBIDDEN_PASSAGE_WORDING = [
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


TRIVIAL_OR_FORMATTING = [
    "page number",
    "which page",
    "unit number",
    "lesson number",
    "exercise number",
    "activity number",
    "section number",
    "what is the heading",
    "what is the title of the lesson",
    "english for today",
]


AMBIGUOUS_STARTS = [
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


rows = []
reason_counts = Counter()
hard_failure_counts = Counter()

normalized_questions = defaultdict(
    list
)


for item in candidates:
    normalized_questions[
        normalize_question(
            item["question"]
        )
    ].append(
        item["candidate_id"]
    )


# Near-duplicate relationships.
near_duplicate_map = defaultdict(list)

for i in range(
    len(candidates)
):
    q1 = normalize_question(
        candidates[i]["question"]
    )

    for j in range(
        i + 1,
        len(candidates)
    ):
        q2 = normalize_question(
            candidates[j]["question"]
        )

        if not q1 or not q2:
            continue

        ratio = SequenceMatcher(
            None,
            q1,
            q2,
        ).ratio()

        # Conservative threshold.
        if ratio >= 0.90:
            id1 = candidates[i][
                "candidate_id"
            ]

            id2 = candidates[j][
                "candidate_id"
            ]

            near_duplicate_map[
                id1
            ].append(
                (
                    id2,
                    round(ratio, 3),
                )
            )

            near_duplicate_map[
                id2
            ].append(
                (
                    id1,
                    round(ratio, 3),
                )
            )


for item in candidates:

    candidate_id = item[
        "candidate_id"
    ]

    question = normalize_space(
        item[
            "question"
        ]
    )

    answer = normalize_space(
        item[
            "gold_answer"
        ]
    )

    evidence = normalize_space(
        item[
            "evidence_quote"
        ]
    )

    chunk_id = item[
        "chunk_id"
    ]

    book_id = item[
        "book_id"
    ]

    reasons = []
    hard_failures = []


    # --------------------------------------------------------------
    # Structural checks
    # --------------------------------------------------------------

    if chunk_id not in eval_by_id:
        hard_failures.append(
            "source_chunk_missing"
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
            hard_failures.append(
                "answer_not_grounded_in_source"
            )

        if not normalized_contains(
            source_text,
            evidence,
        ):
            reasons.append(
                "evidence_not_verbatim_after_normalization"
            )

        if not normalized_contains(
            evidence,
            answer,
        ):
            hard_failures.append(
                "answer_not_in_evidence"
            )


    # --------------------------------------------------------------
    # Closed-book wording
    # --------------------------------------------------------------

    question_lower = (
        question.casefold()
    )

    if any(
        phrase in question_lower
        for phrase
        in FORBIDDEN_PASSAGE_WORDING
    ):
        hard_failures.append(
            "passage_dependent_wording"
        )


    if any(
        phrase in question_lower
        for phrase
        in TRIVIAL_OR_FORMATTING
    ):
        reasons.append(
            "trivial_or_formatting_question"
        )


    # --------------------------------------------------------------
    # Answer quality
    # --------------------------------------------------------------

    answer_words = answer.split()

    if not answer_words:
        hard_failures.append(
            "empty_answer"
        )

    elif len(answer_words) > 12:
        hard_failures.append(
            "answer_over_12_words"
        )


    if answer.casefold() in {
        "yes",
        "no",
        "true",
        "false",
    }:
        reasons.append(
            "very_weak_answer_type"
        )


    # --------------------------------------------------------------
    # Question quality
    # --------------------------------------------------------------

    if not question.endswith("?"):
        hard_failures.append(
            "missing_question_mark"
        )

    if len(question) < 15:
        reasons.append(
            "very_short_question"
        )

    if len(question) > 220:
        reasons.append(
            "very_long_question"
        )


    for pattern in AMBIGUOUS_STARTS:
        if re.search(
            pattern,
            question_lower,
        ):
            reasons.append(
                "possible_unresolved_reference"
            )
            break


    # --------------------------------------------------------------
    # Exact duplicate
    # --------------------------------------------------------------

    normalized_q = normalize_question(
        question
    )

    exact_group = (
        normalized_questions[
            normalized_q
        ]
    )

    if len(exact_group) > 1:
        hard_failures.append(
            "exact_duplicate_question"
        )


    # --------------------------------------------------------------
    # Near duplicate
    # --------------------------------------------------------------

    if candidate_id in (
        near_duplicate_map
    ):
        reasons.append(
            "near_duplicate_question"
        )


    # --------------------------------------------------------------
    # Important benchmark-independence check:
    # Was the generated question already present verbatim
    # in the textbook?
    # --------------------------------------------------------------

    book_text = (
        full_book_normalized[
            book_id
        ]
    )

    normalized_full_question = (
        normalize_for_match(
            question
        )
    )

    if (
        len(
            normalized_full_question.split()
        ) >= 5
        and normalized_full_question
        in book_text
    ):
        reasons.append(
            "question_verbatim_in_textbook"
        )


    # --------------------------------------------------------------
    # Evidence size
    # --------------------------------------------------------------

    evidence_words = (
        evidence.split()
    )

    if len(evidence_words) > 70:
        reasons.append(
            "long_evidence_quote"
        )


    reasons = sorted(
        set(reasons)
    )

    hard_failures = sorted(
        set(hard_failures)
    )


    for reason in reasons:
        reason_counts[
            reason
        ] += 1

    for reason in hard_failures:
        hard_failure_counts[
            reason
        ] += 1


    if hard_failures:
        auto_status = (
            "HARD_FAIL"
        )

    elif reasons:
        auto_status = (
            "REVIEW_REQUIRED"
        )

    else:
        auto_status = (
            "AUTO_PASS"
        )


    near_duplicates = "; ".join(
        (
            f"{other_id}"
            f"({ratio})"
        )
        for other_id, ratio
        in near_duplicate_map.get(
            candidate_id,
            []
        )
    )


    rows.append(
        {
            "candidate_id":
                candidate_id,

            "class_level":
                item[
                    "class_level"
                ],

            "book_id":
                book_id,

            "chunk_id":
                chunk_id,

            "page_start":
                item[
                    "page_start"
                ],

            "page_end":
                item[
                    "page_end"
                ],

            "question":
                question,

            "gold_answer":
                answer,

            "evidence_quote":
                evidence,

            "auto_status":
                auto_status,

            "hard_failures":
                " | ".join(
                    hard_failures
                ),

            "review_reasons":
                " | ".join(
                    reasons
                ),

            "near_duplicates":
                near_duplicates,

            "human_decision":
                "",

            "edited_question":
                "",

            "edited_answer":
                "",

            "accepted_answer_2":
                "",

            "accepted_answer_3":
                "",

            "reviewer_notes":
                "",
        }
    )


status_counts = Counter(
    row[
        "auto_status"
    ]
    for row in rows
)


class_counts = Counter(
    int(
        row[
            "class_level"
        ]
    )
    for row in rows
)


audit_csv = (
    EVAL_DIR
    / "closed_book_eval_quality_audit_v2r3.csv"
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
    "auto_status",
    "hard_failures",
    "review_reasons",
    "near_duplicates",
    "human_decision",
    "edited_question",
    "edited_answer",
    "accepted_answer_2",
    "accepted_answer_3",
    "reviewer_notes",
]


with audit_csv.open(
    "w",
    encoding="utf-8-sig",
    newline="",
) as handle:

    writer = csv.DictWriter(
        handle,
        fieldnames=fields,
    )

    writer.writeheader()
    writer.writerows(
        rows
    )


priority_rows = [
    row
    for row in rows
    if row[
        "auto_status"
    ] != "AUTO_PASS"
]


priority_csv = (
    EVAL_DIR
    / "closed_book_eval_priority_review_v2r3.csv"
)


with priority_csv.open(
    "w",
    encoding="utf-8-sig",
    newline="",
) as handle:

    writer = csv.DictWriter(
        handle,
        fieldnames=fields,
    )

    writer.writeheader()
    writer.writerows(
        priority_rows
    )


summary = {
    "version":
        VERSION,

    "candidate_file":
        str(
            CANDIDATES.relative_to(
                ROOT
            )
        ),

    "candidate_sha256":
        candidate_sha,

    "total_candidates":
        len(candidates),

    "class_distribution": {
        "6":
            class_counts[6],

        "7":
            class_counts[7],

        "8":
            class_counts[8],
    },

    "stage_b_chunk_overlap":
        len(chunk_overlap),

    "stage_b_chunk_overlap_ids":
        sorted(
            chunk_overlap
        ),

    "status_counts":
        dict(
            status_counts
        ),

    "hard_failure_counts":
        dict(
            hard_failure_counts
        ),

    "review_reason_counts":
        dict(
            reason_counts
        ),

    "near_duplicate_pairs":
        sum(
            len(items)
            for items
            in near_duplicate_map.values()
        ) // 2,

    "audit_csv":
        str(
            audit_csv.relative_to(
                ROOT
            )
        ),

    "priority_review_csv":
        str(
            priority_csv.relative_to(
                ROOT
            )
        ),
}


summary_path = (
    REPORT_DIR
    / "closed_book_eval_quality_audit_v2r3_summary.json"
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
print("CLOSED-BOOK BENCHMARK QUALITY AUDIT V2R3")
print("=" * 78)

print(
    "Candidates:",
    len(candidates)
)

print(
    "Class 6:",
    class_counts[6]
)

print(
    "Class 7:",
    class_counts[7]
)

print(
    "Class 8:",
    class_counts[8]
)

print()

print(
    "Stage-B source chunk overlap:",
    len(chunk_overlap)
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

if hard_failure_counts:
    for reason, count in (
        hard_failure_counts.most_common()
    ):
        print(
            f"{reason}: {count}"
        )
else:
    print("None")

print()

print("REVIEW REASONS")
print("-" * 78)

if reason_counts:
    for reason, count in (
        reason_counts.most_common()
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

print(
    "Full audit CSV:",
    audit_csv.relative_to(
        ROOT
    )
)

print(
    "Priority review CSV:",
    priority_csv.relative_to(
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
    "IMPORTANT: Do not lock benchmark yet."
)

print(
    "Every final benchmark item still requires "
    "human ACCEPT / EDIT / REJECT."
)
