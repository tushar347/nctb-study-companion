import json
import hashlib
from pathlib import Path
from collections import Counter

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r4_reviewed.jsonl"
)

OUTPUT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r5_reviewed.jsonl"
)

REPORT = (
    ROOT
    / "research"
    / "reports"
    / "v2"
    / "closed_book_eval_candidates_v2r5_reviewed_summary.json"
)

EXPECTED_SHA = (
    "3d11d67370bc5e6aab82eddc38b364c85e1e405a21b20b3ce6e8c0e2ded5edba"
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


actual_sha = sha256_file(SOURCE)

if actual_sha != EXPECTED_SHA:
    raise SystemExit(
        "STOP: v2r4 SHA256 mismatch.\n"
        f"Expected: {EXPECTED_SHA}\n"
        f"Actual:   {actual_sha}"
    )


records = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig"
) as f:

    for line in f:
        line = line.strip()

        if line:
            records.append(
                json.loads(line)
            )


PATCHES = {

    "CBQ-C6-046": {
        "question":
            "Which two festivals do villagers celebrate with joy?",

        "gold_answer":
            "Pahela Boishakh and Nabanna Utsab",
    },

    "CBQ-C6-047": {
        "question":
            "What does the poem ‘Holding Hands’ describe about elephants?",

        "gold_answer":
            "elephants walk together by holding tails",
    },

    "CBQ-C6-050": None,

    "CBQ-C8-050": {
        "question":
            "What did the boy tell the villagers about?",

        "gold_answer":
            "the pot of golden coins he had found",
    },
}


patched = []

for record in records:

    item = dict(record)

    cid = item["candidate_id"]

    patch = PATCHES.get(cid)

    if patch:

        item["question"] = (
            patch["question"]
        )

        item["gold_answer"] = (
            patch["gold_answer"]
        )

        item[
            "human_review_action"
        ] = "EDIT_CONFIRMED"

        patched.append(cid)

    elif cid == "CBQ-C6-048":

        item[
            "human_review_action"
        ] = "ACCEPT_CONFIRMED"

    records[
        records.index(record)
    ] = item


with OUTPUT.open(
    "w",
    encoding="utf-8"
) as f:

    for record in records:

        f.write(
            json.dumps(
                record,
                ensure_ascii=False
            )
            + "\n"
        )


distribution = Counter(
    int(
        record["class_level"]
    )
    for record in records
)


summary = {
    "version":
        "closed-book-benchmark-candidates-v2r5-reviewed",

    "source_sha256":
        actual_sha,

    "total":
        len(records),

    "class_distribution": {
        "6": distribution[6],
        "7": distribution[7],
        "8": distribution[8],
    },

    "confirmed_edits": [
        "CBQ-C6-046",
        "CBQ-C6-047",
        "CBQ-C8-050",
    ],

    "confirmed_accept":
        "CBQ-C6-048",

    "output_sha256":
        sha256_file(OUTPUT),
}


REPORT.write_text(
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
print("V2R5 REVIEWED BENCHMARK CREATED")
print("=" * 78)

print(
    "Total:",
    len(records)
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
    "Patched:",
    ", ".join(patched)
)

print()

print(
    "SHA256:",
    summary["output_sha256"]
)

print()

print(
    "Output:",
    OUTPUT.relative_to(ROOT)
)

print(
    "Summary:",
    REPORT.relative_to(ROOT)
)

print()
print(
    "NEXT: run final automatic audit before locking."
)
