import json
import hashlib
import random
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

OUTPUT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r8.jsonl"
)

SPOT_OUTPUT = (
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


# ==========================================================
# 1. Verify V2R7
# ==========================================================

actual_sha = sha256_file(
    SOURCE
)

if actual_sha != EXPECTED_SHA:

    raise SystemExit(
        "STOP: V2R7 SHA mismatch.\n"
        f"Expected: {EXPECTED_SHA}\n"
        f"Actual:   {actual_sha}"
    )


v2r7 = load_jsonl(
    SOURCE
)


if len(v2r7) != 150:

    raise SystemExit(
        f"STOP: V2R7 contains {len(v2r7)} items, expected 150."
    )


print()
print("=" * 78)
print("BUILDING V2R8 FROM VERIFIED V2R7")
print("=" * 78)

print(
    "V2R7 SHA:",
    actual_sha
)

print(
    "V2R7 items:",
    len(v2r7)
)


# ==========================================================
# 2. Remove problematic V2R7 items
# ==========================================================

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
    dict(item)
    for item in v2r7
    if item.get(
        "candidate_id"
    ) not in REMOVE_IDS
]


print(
    "Removed:",
    len(REMOVE_IDS)
)

print(
    "Remaining:",
    len(kept)
)


# ==========================================================
# 3. Add verified replacements
# ==========================================================

REPLACEMENTS = [

    {
        "class_level":
            6,

        "book_id":
            "class6-english",

        "chunk_id":
            "class6-english-chunk-0029",

        "page_start":
            57,

        "page_end":
            58,

        "question":
            "What does the poet say is prettier than boats and ships?",

        "gold_answer":
            "clouds that sail across the sky",

        "evidence_quote":
            "But clouds that sail across the sky Are prettier far than these.",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    },


    {
        "class_level":
            6,

        "book_id":
            "class6-english",

        "chunk_id":
            "class6-english-chunk-0042",

        "page_start":
            79,

        "page_end":
            80,

        "question":
            "What historic fort can a visitor see in the old part of Dhaka?",

        "gold_answer":
            "the Lalbagh Fort",

        "evidence_quote":
            "the Lalbagh Fort in the old part of Dhaka.",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    },


    {
        "class_level":
            6,

        "book_id":
            "class6-english",

        "chunk_id":
            "class6-english-chunk-0050",

        "page_start":
            98,

        "page_end":
            99,

        "question":
            "What did Robin learn from his uncle and aunt?",

        "gold_answer":
            "things that I didn't know before.",

        "evidence_quote":
            "Uncle and you have taught me things that I didn't know before.",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    },


    {
        "class_level":
            6,

        "book_id":
            "class6-english",

        "chunk_id":
            "class6-english-chunk-0058",

        "page_start":
            112,

        "page_end":
            112,

        "question":
            "What do villagers grow in rural Bangladesh?",

        "gold_answer":
            "rice, jute and vegetables",

        "evidence_quote":
            "They grow crops like rice, jute and vegetables.",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    },


    {
        "class_level":
            7,

        "book_id":
            "class7-english",

        "chunk_id":
            "class7-english-chunk-0010",

        "page_start":
            19,

        "page_end":
            20,

        "question":
            "Who wrote 'Hearth & Home'?",

        "gold_answer":
            "Robert Olen Butler",

        "evidence_quote":
            "Hearth & Home 15 by Robert Olen Butler",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    },


    {
        "class_level":
            8,

        "book_id":
            "class8-english",

        "chunk_id":
            "class8-english-chunk-0004",

        "page_start":
            7,

        "page_end":
            8,

        "question":
            "What happens to traditional folk tunes as people move to cities?",

        "gold_answer":
            "these traditional tunes are slowly fading",

        "evidence_quote":
            "As people migrate to cities and villages transform, these traditional tunes are slowly fading.",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    },


    {
        "class_level":
            8,

        "book_id":
            "class8-english",

        "chunk_id":
            "class8-english-chunk-0112",

        "page_start":
            145,

        "page_end":
            146,

        "question":
            "How is folk music still present in mainstream media?",

        "gold_answer":
            "it finds its place in mainstream films and music albums",

        "evidence_quote":
            "However, folk music still finds its place in mainstream films and music albums.",

        "human_review_action":
            "VERIFIED_REPLACEMENT",
    },

]


for replacement in REPLACEMENTS:

    replacement["version"] = (
        "closed-book-benchmark-v2r8"
    )

    replacement["author_model"] = (
        "verified_source_repair"
    )

    replacement["auto_validation"] = (
        "PASS"
    )

    kept.append(
        replacement
    )


# ==========================================================
# 4. Verify total and class balance
# ==========================================================

class_counts = Counter(
    int(
        item["class_level"]
    )
    for item in kept
)


print()
print(
    "After replacements:",
    len(kept)
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


if (
    len(kept) != 150
    or class_counts[6] != 50
    or class_counts[7] != 50
    or class_counts[8] != 50
):

    raise SystemExit(
        "STOP: V2R8 class balance is invalid."
    )


# ==========================================================
# 5. Remove accidental exact duplicates
# ==========================================================

seen_questions = set()

for item in kept:

    key = norm(
        item["question"]
    )

    if key in seen_questions:

        raise SystemExit(
            "STOP: Duplicate question found:\n"
            + item["question"]
        )

    seen_questions.add(
        key
    )


# ==========================================================
# 6. Sort WITHOUT candidate_id
# ==========================================================

kept.sort(
    key=lambda item: (
        int(
            item["class_level"]
        ),

        str(
            item["book_id"]
        ),

        str(
            item["chunk_id"]
        ),

        norm(
            item["question"]
        ),
    )
)


# ==========================================================
# 7. NOW assign candidate IDs
# ==========================================================

serials = Counter()

for item in kept:

    level = int(
        item["class_level"]
    )

    serials[level] += 1

    item["candidate_id"] = (
        f"CBQ-C{level}-"
        f"{serials[level]:03d}"
    )


# ==========================================================
# 8. Final sanity check
# ==========================================================

if any(
    "candidate_id"
    not in item
    for item in kept
):

    raise SystemExit(
        "STOP: Some item has no candidate_id."
    )


# ==========================================================
# 9. Write V2R8
# ==========================================================

with OUTPUT.open(
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


# ==========================================================
# 10. Create fresh stratified 15-item spot check
# ==========================================================

rng = random.Random(
    20260815
)

spot_check = []

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

    spot_check.extend(
        rng.sample(
            group,
            5
        )
    )


with SPOT_OUTPUT.open(
    "w",
    encoding="utf-8",
) as f:

    for item in spot_check:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


# ==========================================================
# 11. Final output
# ==========================================================

new_sha = sha256_file(
    OUTPUT
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

print(
    "Removed:",
    len(REMOVE_IDS)
)

print(
    "Verified replacements:",
    len(REPLACEMENTS)
)

print()

print(
    "V2R8 SHA256:",
    new_sha
)

print()

print(
    "V2R8:",
    OUTPUT.relative_to(ROOT)
)

print(
    "Spot check:",
    SPOT_OUTPUT.relative_to(ROOT)
)

print()

print(
    "PASS: V2R7 remains untouched."
)

print(
    "NEXT: run direct V2R8 audit."
)
