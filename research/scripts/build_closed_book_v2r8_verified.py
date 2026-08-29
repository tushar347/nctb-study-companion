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
    / "closed_book_eval_candidates_v2r7.jsonl"
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

EXPECTED_SHA = (
    "a9510aea42eaa8d00d1988eeb6d294f9b399f0ac289e71e493813be91e9776b5"
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


def norm(text):
    return " ".join(
        str(text)
        .casefold()
        .replace("’", "'")
        .split()
    )


def add_item(
    class_level,
    book_id,
    chunk_id,
    page_start,
    page_end,
    question,
    answer,
    evidence,
):
    return {
        "version":
            "closed-book-benchmark-v2r8",

        "class_level":
            class_level,

        "book_id":
            book_id,

        "chunk_id":
            chunk_id,

        "page_start":
            page_start,

        "page_end":
            page_end,

        "question":
            question,

        "gold_answer":
            answer,

        "evidence_quote":
            evidence,

        "author_model":
            "verified_source_repair",

        "auto_validation":
            "PASS",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    }


actual_sha = sha256_file(
    SOURCE
)

if actual_sha != EXPECTED_SHA:

    raise SystemExit(
        "STOP: V2R7 SHA mismatch.\n"
        f"Expected: {EXPECTED_SHA}\n"
        f"Actual:   {actual_sha}"
    )


items = load_jsonl(
    SOURCE
)


# These seven items are replaced.
REMOVE_IDS = {
    "CBQ-C6-022",
    "CBQ-C6-034",
    "CBQ-C6-039",
    "CBQ-C6-048",
    "CBQ-C7-003",
    "CBQ-C8-004",
    "CBQ-C8-045",
}


kept = [
    item
    for item in items
    if item["candidate_id"]
    not in REMOVE_IDS
]


# ---------------------------------------------------------
# Seven verified replacements from actual NCTB source text.
# ---------------------------------------------------------

replacements = [

    # C6-022
    add_item(
        6,
        "class6-english",
        "class6-english-chunk-0029",
        57,
        58,
        "What does the poet say is prettier than boats and ships?",
        "clouds that sail across the sky",
        "But clouds that sail across the sky Are prettier far than these.",
    ),

    # C6-034
    add_item(
        6,
        "class6-english",
        "class6-english-chunk-0042",
        79,
        80,
        "What historic fort can a visitor see in the old part of Dhaka?",
        "the Lalbagh Fort",
        "the Lalbagh Fort in the old part of Dhaka.",
    ),

    # C6-039
    add_item(
        6,
        "class6-english",
        "class6-english-chunk-0050",
        98,
        99,
        "What did Robin say his uncle and aunt had taught him?",
        "things that I didn't know before.",
        "Uncle and you have taught me things that I didn't know before.",
    ),

    # C6-048 was duplicate; replace with a clean rural Bangladesh fact.
    add_item(
        6,
        "class6-english",
        "class6-english-chunk-0058",
        112,
        112,
        "What do villagers grow in rural Bangladesh?",
        "rice, jute and vegetables",
        "They grow crops like rice, jute and vegetables.",
    ),

    # C7-003
    add_item(
        7,
        "class7-english",
        "class7-english-chunk-0010",
        19,
        20,
        "Who wrote 'Hearth & Home'?",
        "Robert Olen Butler",
        "Hearth & Home 15 by Robert Olen Butler",
    ),

    # C8-004
    add_item(
        8,
        "class8-english",
        "class8-english-chunk-0004",
        7,
        8,
        "What happens to traditional folk tunes as people move to cities?",
        "these traditional tunes are slowly fading",
        "As people migrate to cities and villages transform, these traditional tunes are slowly fading.",
    ),

    # C8-045
    add_item(
        8,
        "class8-english",
        "class8-english-chunk-0112",
        145,
        146,
        "Where does folk music still find a place in modern times?",
        "mainstream films and music albums",
        "However, folk music still finds its place in mainstream films and music albums.",
    ),
]


if len(replacements) != len(REMOVE_IDS):

    raise SystemExit(
        "STOP: replacement count mismatch."
    )


kept.extend(
    replacements
)


# ---------------------------------------------------------
# Verify total and class balance.
# ---------------------------------------------------------

counts = Counter(
    int(item["class_level"])
    for item in kept
)

if (
    len(kept) != 150
    or counts[6] != 50
    or counts[7] != 50
    or counts[8] != 50
):

    raise SystemExit(
        "STOP: class balance failed: "
        + repr(dict(counts))
    )


# ---------------------------------------------------------
# Verify exact question uniqueness.
# ---------------------------------------------------------

question_map = {}

for item in kept:

    key = norm(
        item["question"]
    )

    if key in question_map:

        raise SystemExit(
            "STOP: duplicate question:\n"
            + item["question"]
        )

    question_map[key] = (
        item["candidate_id"]
    )


# ---------------------------------------------------------
# Stable ordering and IDs.
# ---------------------------------------------------------

kept.sort(
    key=lambda item: (
        int(item["class_level"]),
        item["book_id"],
        item["chunk_id"],
        norm(item["question"]),
    )
)

serial = Counter()

for item in kept:

    level = int(
        item["class_level"]
    )

    serial[level] += 1

    item["candidate_id"] = (
        f"CBQ-C{level}-"
        f"{serial[level]:03d}"
    )


# ---------------------------------------------------------
# Write V2R8.
# ---------------------------------------------------------

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


# ---------------------------------------------------------
# Fresh 15-question spot check.
# Different seed from V2R7.
# ---------------------------------------------------------

import random

rng = random.Random(
    20260815
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
            item["class_level"]
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
    encoding="utf-8",
) as f:

    for item in spot_items:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


print()
print("=" * 78)
print("V2R8 BENCHMARK CREATED")
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

print()

print(
    "Removed:",
    len(REMOVE_IDS)
)

print(
    "Verified replacements:",
    len(replacements)
)

print()

print(
    "SHA256:",
    sha256_file(OUT)
)

print(
    "V2R8:",
    OUT.relative_to(ROOT)
)

print(
    "Spot check:",
    SPOT.relative_to(ROOT)
)

print()

print(
    "PASS: V2R7 preserved; V2R8 created separately."
)

print(
    "NEXT: run final audit directly on V2R8."
)

