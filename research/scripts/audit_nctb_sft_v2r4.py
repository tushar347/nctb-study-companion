import json
import re
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(r"D:\nctb-study-companion-starter")

CANDIDATES = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "sft"
    / "nctb_sft_candidates_v2r4.jsonl"
)

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_sft_source_chunks_v2r3.jsonl"
)

REPORT = (
    ROOT
    / "research"
    / "reports"
    / "v2"
    / "nctb_sft_audit_v2r4_summary.json"
)

AUDIT_CSV = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "sft"
    / "nctb_sft_audit_v2r4.csv"
)


def norm(text):
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


def contains(container, value):
    c = norm(container)
    v = norm(value)
    return bool(v) and v in c


candidates = []

with CANDIDATES.open(
    "r",
    encoding="utf-8-sig",
) as f:

    for line in f:
        line = line.strip()

        if line:
            candidates.append(
                json.loads(line)
            )


source_chunks = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig",
) as f:

    for line in f:
        line = line.strip()

        if line:
            source_chunks.append(
                json.loads(line)
            )


source_by_id = {
    row["chunk_id"]: row
    for row in source_chunks
}


print()
print("=" * 78)
print("NCTB SFT CANDIDATE AUDIT V2R4")
print("=" * 78)

print(
    "Candidates:",
    len(candidates)
)

print(
    "Source chunks:",
    len(source_chunks)
)


status_counts = Counter()
class_counts = Counter()
task_counts = Counter()
reason_counts = Counter()

duplicates = defaultdict(list)
audit_rows = []


for item in candidates:

    example_id = item.get(
        "example_id",
        "",
    )

    question = str(
        item.get(
            "question",
            "",
        )
    ).strip()

    answer = str(
        item.get(
            "answer",
            "",
        )
    ).strip()

    evidence = str(
        item.get(
            "evidence_quote",
            "",
        )
    ).strip()

    passage = str(
        item.get(
            "passage",
            "",
        )
    ).strip()

    task = str(
        item.get(
            "task_type",
            "",
        )
    ).strip()

    level = int(
        item.get(
            "class_level",
            0,
        )
    )

    class_counts[level] += 1
    task_counts[task] += 1

    duplicates[
        norm(question)
    ].append(
        example_id
    )


    reasons = []

    source_text = ""

    source_ids = item.get(
        "source_chunk_ids",
        [],
    )

    missing_sources = []

    for source_id in source_ids:

        source = source_by_id.get(
            source_id
        )

        if source is None:
            missing_sources.append(
                source_id
            )
        else:
            source_text += (
                "\n"
                + str(
                    source.get(
                        "text",
                        "",
                    )
                )
            )


    if missing_sources:
        reasons.append(
            "missing_source_chunk"
        )


    if not question.endswith("?"):
        reasons.append(
            "missing_question_mark"
        )


    if len(question) < 10:
        reasons.append(
            "very_short_question"
        )


    if not evidence:
        reasons.append(
            "missing_evidence"
        )


    if evidence and not contains(
        source_text,
        evidence,
    ):
        reasons.append(
            "evidence_not_in_source"
        )


    # Detect visible mojibake / replacement characters.
    if (
        "�" in question
        or "�" in answer
        or "�" in evidence
        or "�" in passage
        or "â" in question
        or "â" in answer
        or "â" in evidence
        or "â" in passage
    ):
        reasons.append(
            "encoding_artifact"
        )


    if task == "short_qa":

        if not answer:
            reasons.append(
                "empty_answer"
            )

        if len(
            answer.split()
        ) > 25:
            reasons.append(
                "answer_too_long"
            )

        if answer and evidence:

            if not contains(
                evidence,
                answer,
            ):
                reasons.append(
                    "answer_not_in_evidence"
                )


    elif task == "mcq":

        options = item.get(
            "options",
            [],
        )

        correct = str(
            item.get(
                "correct_answer",
                "",
            )
        ).strip()

        if not isinstance(
            options,
            list
        ) or len(options) != 4:

            reasons.append(
                "invalid_mcq_options"
            )

        else:

            options_clean = [
                str(x).strip()
                for x in options
            ]

            if correct not in options_clean:
                reasons.append(
                    "correct_answer_not_option"
                )

            if evidence and not contains(
                evidence,
                correct,
            ):
                reasons.append(
                    "mcq_answer_not_in_evidence"
                )


    elif task == "passage_grounded_qa":

        if not passage:
            reasons.append(
                "missing_passage"
            )

        elif not contains(
            source_text,
            passage,
        ):
            reasons.append(
                "passage_not_in_source"
            )

        if not answer:
            reasons.append(
                "empty_answer"
            )

        if evidence and answer:

            if not contains(
                evidence,
                answer,
            ):
                reasons.append(
                    "grounded_answer_not_in_evidence"
                )


    else:

        reasons.append(
            "unknown_task_type"
        )


    reasons = sorted(
        set(reasons)
    )


    if reasons:
        status = "REVIEW_REQUIRED"
    else:
        status = "AUTO_PASS"


    status_counts[
        status
    ] += 1


    for reason in reasons:
        reason_counts[
            reason
        ] += 1


    audit_rows.append(
        {
            "example_id":
                example_id,

            "class_level":
                level,

            "task_type":
                task,

            "question":
                question,

            "answer":
                answer,

            "status":
                status,

            "reasons":
                " | ".join(reasons),
        }
    )


# Exact duplicate questions
duplicate_question_groups = {
    q: ids
    for q, ids in duplicates.items()
    if q and len(ids) > 1
}

for ids in duplicate_question_groups.values():
    reason_counts[
        "duplicate_question"
    ] += len(ids)


print()
print("AUTO STATUS")
print("-" * 78)

print(
    "AUTO_PASS:",
    status_counts["AUTO_PASS"],
)

print(
    "REVIEW_REQUIRED:",
    status_counts["REVIEW_REQUIRED"],
)


print()
print("CLASS DISTRIBUTION")
print("-" * 78)

for level in (6, 7, 8):
    print(
        f"Class {level}:",
        class_counts[level],
    )


print()
print("TASK DISTRIBUTION")
print("-" * 78)

for task, count in task_counts.items():
    print(
        f"{task}:",
        count,
    )


print()
print("AUDIT REASONS")
print("-" * 78)

if reason_counts:
    for reason, count in (
        reason_counts.most_common()
    ):
        print(
            f"{reason}:",
            count,
        )
else:
    print("None")


print()
print(
    "Exact duplicate question groups:",
    len(
        duplicate_question_groups
    ),
)


# Show first 20 review items.
review_rows = [
    row
    for row in audit_rows
    if row["status"]
    == "REVIEW_REQUIRED"
]


print()
print("FIRST REVIEW ITEMS")
print("-" * 78)

for row in review_rows[:20]:

    print()
    print(
        row["example_id"],
        "| Class",
        row["class_level"],
        "|",
        row["task_type"],
    )

    print(
        "Q:",
        row["question"],
    )

    print(
        "Reason:",
        row["reasons"],
    )


# Write CSV
import csv

with AUDIT_CSV.open(
    "w",
    encoding="utf-8-sig",
    newline="",
) as f:

    fields = [
        "example_id",
        "class_level",
        "task_type",
        "question",
        "answer",
        "status",
        "reasons",
    ]

    writer = csv.DictWriter(
        f,
        fieldnames=fields,
    )

    writer.writeheader()
    writer.writerows(
        audit_rows
    )


summary = {
    "version":
        "nctb-sft-audit-v2r4",

    "candidate_count":
        len(candidates),

    "source_chunk_count":
        len(source_chunks),

    "status_counts":
        dict(status_counts),

    "class_distribution":
        dict(class_counts),

    "task_distribution":
        dict(task_counts),

    "reason_counts":
        dict(reason_counts),

    "duplicate_question_groups":
        len(
            duplicate_question_groups
        ),

    "audit_csv":
        str(
            AUDIT_CSV.relative_to(
                ROOT
            )
        ),
}


REPORT.write_text(
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
print("SFT AUDIT COMPLETE")
print("=" * 78)

print(
    "Candidate examples:",
    len(candidates),
)

print(
    "Auto-pass:",
    status_counts["AUTO_PASS"],
)

print(
    "Review required:",
    status_counts["REVIEW_REQUIRED"],
)

print(
    "Audit CSV:",
    AUDIT_CSV.relative_to(ROOT),
)

print(
    "Summary:",
    REPORT.relative_to(ROOT),
)

print()
print(
    "NEXT: create a filtered training set from AUTO_PASS items only."
)
