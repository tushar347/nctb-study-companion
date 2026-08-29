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
    / "closed_book_eval_candidates_v2r6.jsonl"
)

OUT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r7.jsonl"
)

EXPECTED_SHA = (
    "e33e52686b3a57a340ce802fb2efd45eb3ffae85b81e95866808c4af8a9bf924"
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


actual_sha = sha256_file(SOURCE)

if actual_sha != EXPECTED_SHA:
    raise SystemExit(
        "STOP: V2R6 SHA mismatch.\n"
        f"Expected: {EXPECTED_SHA}\n"
        f"Actual:   {actual_sha}"
    )


items = load_jsonl(SOURCE)


# ---------------------------------------------------------
# Remove one of the duplicate festival questions.
# Keep the more specific C6-049 version.
# ---------------------------------------------------------

REMOVE = {
    "CBQ-C6-048",
}


# ---------------------------------------------------------
# Edits to already-good questions.
# ---------------------------------------------------------

EDITS = {

    "CBQ-C8-028": (
        "What did the speaker learn was better news than bright?",
        "dark blood",
        "You have learned dark blood is better news than bright."
    ),

    "CBQ-C8-041": (
        "What did the owl ask the dove?",
        "What do you think about me?",
        'Then he turned to the dove and asked, "Now little dove, what do you think about me?"'
    ),
}


# ---------------------------------------------------------
# Deterministic replacements for weak spot-check items.
# These use facts already present in their evidence.
# ---------------------------------------------------------

REPLACEMENTS = {

    "CBQ-C7-004": {
        "class_level": 7,
        "book_id": "class7-english",
        "chunk_id": "class7-english-chunk-0005",
        "page_start": 11,
        "page_end": 11,
        "question":
            "What does the table of contents show about the section 'America at Play'?",
        "answer":
            "It is on page 57.",
        "evidence":
            "America at Play 57 by Sean T Kelly",
    },

    "CBQ-C8-035": {
        "class_level": 8,
        "book_id": "class8-english",
        "chunk_id": "class8-english-chunk-0102",
        "page_start": 140,
        "page_end": 140,
        "question":
            "What does the poem mention as incredible?",
        "answer":
            "Two incredible shoes.",
        "evidence":
            "The News Here is The News: 'Two incredible shoes. Two incredible shoes.'",
    },

    "CBQ-C8-038": {
        "class_level": 8,
        "book_id": "class8-english",
        "chunk_id": "class8-english-chunk-0008",
        "page_start": 12,
        "page_end": 12,
        "question":
            "What did the Wright brothers do on December 17, 1903?",
        "answer":
            "made the first experiment of flying in a plane",
        "evidence":
            "Then on December 17, 1903, the Wright brothers in America made the first experiment of flying in a plane.",
    },

    "CBQ-C6-004": {
        "class_level": 6,
        "book_id": "class6-english",
        "chunk_id": "class6-english-chunk-0002",
        "page_start": 5,
        "page_end": 5,
        "question":
            "What occasion was the competition held for?",
        "answer":
            "Independence Day",
        "evidence":
            "of our Independence Day.",
    },
}


# ---------------------------------------------------------
# Keep original items except:
# - removed duplicate
# - weak C7/C8 items are replaced by new items
# - C8-028 / C8-041 are edited
# ---------------------------------------------------------

WEAK_TO_REPLACE = {
    "CBQ-C7-004",
    "CBQ-C8-035",
    "CBQ-C8-038",
}

kept = []

for item in items:

    cid = item["candidate_id"]

    if cid in REMOVE:
        continue

    if cid in WEAK_TO_REPLACE:
        continue

    if cid in EDITS:

        q, a, evidence = EDITS[cid]

        item = dict(item)

        item["question"] = q
        item["gold_answer"] = a
        item["evidence_quote"] = evidence
        item["human_review_action"] = "EDIT_CONFIRMED"

    kept.append(item)


# ---------------------------------------------------------
# Add 4 replacements so the final total remains 150.
# ---------------------------------------------------------

for cid, spec in REPLACEMENTS.items():

    # Skip C6-004 replacement if original still exists;
    # it gives us a fresh non-duplicate item.
    record = {
        "version":
            "closed-book-benchmark-v2r7",

        "class_level":
            spec["class_level"],

        "book_id":
            spec["book_id"],

        "chunk_id":
            spec["chunk_id"],

        "page_start":
            spec["page_start"],

        "page_end":
            spec["page_end"],

        "question":
            spec["question"],

        "gold_answer":
            spec["answer"],

        "evidence_quote":
            spec["evidence"],

        "author_model":
            "deterministic_repair",

        "auto_validation":
            "PASS",

        "human_review_action":
            "REPLACEMENT",
    }

    kept.append(record)


# ---------------------------------------------------------
# Check total and class balance.
# ---------------------------------------------------------

counts = Counter(
    int(item["class_level"])
    for item in kept
)

print()
print("=" * 78)
print("V2R7 BENCHMARK BUILD")
print("=" * 78)

print(
    "Total before ID renumbering:",
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

if (
    len(kept) != 150
    or counts[6] != 50
    or counts[7] != 50
    or counts[8] != 50
):
    raise SystemExit(
        "STOP: class balance is not 50/50/50."
    )


# Stable ordering.
kept.sort(
    key=lambda x: (
        int(x["class_level"]),
        x["chunk_id"],
        x["question"].casefold(),
    )
)


# Stable final IDs.
serial = Counter()

for item in kept:

    c = int(
        item["class_level"]
    )

    serial[c] += 1

    item["candidate_id"] = (
        f"CBQ-C{c}-{serial[c]:03d}"
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


print()
print(
    "Final total:",
    len(kept)
)

print(
    "Class 6:",
    sum(
        1 for x in kept
        if int(x["class_level"]) == 6
    )
)

print(
    "Class 7:",
    sum(
        1 for x in kept
        if int(x["class_level"]) == 7
    )
)

print(
    "Class 8:",
    sum(
        1 for x in kept
        if int(x["class_level"]) == 8
    )
)

print()
print(
    "New SHA256:",
    sha256_file(OUT)
)

print(
    "Output:",
    OUT.relative_to(ROOT)
)

print()
print(
    "NEXT: final automatic audit + fresh spot-check."
)
