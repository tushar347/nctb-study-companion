import hashlib
import json
import re
from collections import Counter, defaultdict
from difflib import SequenceMatcher
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

SFT_SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_sft_source_chunks_v2r3.jsonl"
)

EXPECTED_SHA = (
    "8324007f5fe30a1c438fc775c2d171ef1fe8e7da49904b86940ecb45e0f9aae4"
)


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
    with path.open("r", encoding="utf-8-sig") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


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
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return " ".join(text.split())


def normalized_contains(container, value):
    c = norm(container)
    v = norm(value)
    return bool(v) and v in c


actual_sha = sha256_file(BENCHMARK)

print()
print("=" * 78)
print("DIRECT V2R8 BENCHMARK AUDIT")
print("=" * 78)

print("Candidate SHA256:", actual_sha)
print(
    "SHA check:",
    "PASS" if actual_sha == EXPECTED_SHA else "FAIL"
)

if actual_sha != EXPECTED_SHA:
    raise SystemExit(
        "STOP: V2R8 SHA mismatch."
    )


benchmark = load_jsonl(BENCHMARK)
eval_chunks = load_jsonl(EVAL_SOURCE)
sft_chunks = load_jsonl(SFT_SOURCE)

eval_by_id = {
    row["chunk_id"]: row
    for row in eval_chunks
}

eval_ids = set(eval_by_id)
sft_ids = {
    row["chunk_id"]
    for row in sft_chunks
}

overlap = eval_ids & sft_ids

print()
print("Candidates:", len(benchmark))

class_counts = Counter(
    int(row["class_level"])
    for row in benchmark
)

print("Class 6:", class_counts[6])
print("Class 7:", class_counts[7])
print("Class 8:", class_counts[8])

print()
print(
    "Stage-B source chunk overlap:",
    len(overlap)
)

hard = Counter()
review = Counter()
statuses = Counter()

question_groups = defaultdict(list)

for row in benchmark:
    question_groups[
        norm(row["question"])
    ].append(
        row["candidate_id"]
    )

near_pairs = set()

for i in range(len(benchmark)):
    q1 = norm(
        benchmark[i]["question"]
    )

    for j in range(i + 1, len(benchmark)):
        q2 = norm(
            benchmark[j]["question"]
        )

        if not q1 or not q2:
            continue

        score = SequenceMatcher(
            None,
            q1,
            q2,
        ).ratio()

        if score >= 0.90:
            near_pairs.add(
                tuple(sorted((
                    benchmark[i]["candidate_id"],
                    benchmark[j]["candidate_id"],
                )))
            )


for row in benchmark:

    item_hard = []
    item_review = []

    cid = row["candidate_id"]
    question = str(row["question"]).strip()
    answer = str(row["gold_answer"]).strip()
    evidence = str(row["evidence_quote"]).strip()

    chunk_id = row["chunk_id"]

    if chunk_id not in eval_by_id:
        item_hard.append("missing_eval_source_chunk")
        source = ""
    else:
        source = eval_by_id[chunk_id]["text"]

    if not answer:
        item_hard.append("empty_answer")

    elif len(answer.split()) > 12:
        item_hard.append("answer_over_12_words")

    if not question.endswith("?"):
        item_hard.append("missing_question_mark")

    if chunk_id in eval_by_id:

        if not normalized_contains(
            source,
            answer,
        ):
            item_hard.append(
                "answer_not_grounded_in_source"
            )

        if not normalized_contains(
            evidence,
            answer,
        ):
            item_hard.append(
                "answer_not_in_evidence"
            )

        if not normalized_contains(
            source,
            evidence,
        ):
            item_review.append(
                "evidence_not_exact_after_normalization"
            )


    forbidden = [
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

    qlower = question.casefold()

    if any(
        phrase in qlower
        for phrase in forbidden
    ):
        item_hard.append(
            "passage_dependent_wording"
        )


    if len(question) < 15:
        item_review.append(
            "very_short_question"
        )

    if len(question) > 220:
        item_review.append(
            "very_long_question"
        )


    ambiguous_patterns = [
        r"^what did he\b",
        r"^what did she\b",
        r"^what did they\b",
        r"^why did he\b",
        r"^why did she\b",
        r"^where did he\b",
        r"^where did she\b",
        r"^what does he\b",
        r"^what does she\b",
        r"^what does it\b",
    ]

    if any(
        re.search(
            pattern,
            qlower,
        )
        for pattern in ambiguous_patterns
    ):
        item_review.append(
            "possible_unresolved_reference"
        )


    if len(
        question_groups[
            norm(question)
        ]
    ) > 1:
        item_hard.append(
            "exact_duplicate_question"
        )


    if any(
        cid in pair
        for pair in near_pairs
        for cid in (
            row["candidate_id"],
        )
    ):
        item_review.append(
            "near_duplicate_question"
        )


    if item_hard:
        status = "HARD_FAIL"
    elif item_review:
        status = "REVIEW_REQUIRED"
    else:
        status = "AUTO_PASS"


    statuses[status] += 1

    for reason in item_hard:
        hard[reason] += 1

    for reason in item_review:
        review[reason] += 1

    if status != "AUTO_PASS":
        print()
        print(
            cid,
            "|",
            status,
        )
        print(
            "Q:",
            question,
        )
        print(
            "A:",
            answer,
        )

        if item_hard:
            print(
                "Hard:",
                ", ".join(item_hard)
            )

        if item_review:
            print(
                "Review:",
                ", ".join(item_review)
            )


print()
print("=" * 78)
print("V2R8 AUDIT RESULT")
print("=" * 78)

print(
    "AUTO_PASS:",
    statuses["AUTO_PASS"]
)

print(
    "REVIEW_REQUIRED:",
    statuses["REVIEW_REQUIRED"]
)

print(
    "HARD_FAIL:",
    statuses["HARD_FAIL"]
)

print()
print("HARD FAILURE REASONS")

if hard:
    for reason, count in hard.most_common():
        print(
            f"{reason}: {count}"
        )
else:
    print("None")

print()
print("REVIEW REASONS")

if review:
    for reason, count in review.most_common():
        print(
            f"{reason}: {count}"
        )
else:
    print("None")

print()
print(
    "Near-duplicate pairs:",
    len(near_pairs)
)

print()

if (
    len(benchmark) == 150
    and class_counts[6] == 50
    and class_counts[7] == 50
    and class_counts[8] == 50
    and len(overlap) == 0
    and statuses["HARD_FAIL"] == 0
    and len(near_pairs) == 0
):
    print(
        "AUTOMATIC INTEGRITY: PASS"
    )
else:
    print(
        "AUTOMATIC INTEGRITY: REVIEW"
    )

print()
print(
    "Candidate SHA256:",
    actual_sha
)
