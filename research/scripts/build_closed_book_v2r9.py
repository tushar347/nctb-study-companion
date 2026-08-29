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
    / "closed_book_eval_candidates_v2r8.jsonl"
)

OUT = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r9.jsonl"
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
    return " ".join(
        str(text or "")
        .casefold()
        .replace("’", "'")
        .split()
    )


actual_sha = sha256_file(SOURCE)

if actual_sha != EXPECTED_SHA:
    raise SystemExit(
        "STOP: V2R8 SHA mismatch.\n"
        f"Expected: {EXPECTED_SHA}\n"
        f"Actual:   {actual_sha}"
    )

items = load_jsonl(SOURCE)

print()
print("=" * 78)
print("V2R9 PROVENANCE REPAIR")
print("=" * 78)

print("V2R8 items:", len(items))

# ---------------------------------------------------------
# Fix provenance/source IDs and evidence.
# ---------------------------------------------------------

PATCHES = {

    "CBQ-C6-001": {
        "chunk_id":
            "class6-english-chunk-0005",

        "page_start":
            10,

        "page_end":
            10,

        "evidence_quote":
            "Manzoor is a student of class six in a Sovernment high school in Rajbari. Recently there was an inter-school essay competition on the occasion of our Independence Day.",

        "gold_answer":
            "Independence Day",
    },

    "CBQ-C7-001": {
        "chunk_id":
            "class7-english-chunk-0010",

        "page_start":
            19,

        "page_end":
            20,

        "evidence_quote":
            "Ametica at Play 57 by Sean T Kelly",

        "gold_answer":
            "It is on page 57.",
    },

    "CBQ-C8-006": {
        "chunk_id":
            "class8-english-chunk-0094",

        "page_start":
            127,

        "page_end":
            128,

        "question":
            "What did the Wright brothers do on December 17, 1903?",

        "gold_answer":
            "made the first experiment of flying in a plane",

        "evidence_quote":
            "Then on December 17, 1903, the Wright brothers in America made the first experiment of flying in a plane.",
    },

    "CBQ-C8-041": {
        "chunk_id":
            "class8-english-chunk-0084",

        "page_start":
            111,

        "page_end":
            112,

        "question":
            "What does the poem mention as incredible?",

        "gold_answer":
            "Two incredible shoes.",

        "evidence_quote":
            'The News Here is The News: “Two incredible shoes. Two incredible shoes. That’s The News.',
    },

    "CBQ-C8-045": {
        "chunk_id":
            "class8-english-chunk-0004",

        "page_start":
            8,

        "page_end":
            8,

        "question":
            "How is folk music still present in mainstream media?",

        "gold_answer":
            "it finds its place in mainstream films and music albums",

        "evidence_quote":
            "However, folk music still finds its place in mainstream films and music albums.",
    },
}


# ---------------------------------------------------------
# Remove ONE duplicate.
# Keep C7-006 and remove C7-008.
# ---------------------------------------------------------

REMOVE = {
    "CBQ-C7-008",
}


kept = []

for item in items:

    cid = item["candidate_id"]

    if cid in REMOVE:
        continue

    item = dict(item)

    if cid in PATCHES:

        patch = PATCHES[cid]

        for key, value in patch.items():
            item[key] = value

        item[
            "human_review_action"
        ] = "PROVENANCE_REPAIRED"

    kept.append(item)


# ---------------------------------------------------------
# Add one replacement for the removed duplicate.
#
# Use an actual Class 7 fact from the evaluation corpus
# that is already present in the diagnostic source.
# ---------------------------------------------------------

replacement = {
    "version":
        "closed-book-benchmark-v2r9",

    "class_level":
        7,

    "book_id":
        "class7-english",

    "chunk_id":
        "class7-english-chunk-0045",

    "page_start":
        81,

    "page_end":
        81,

    "question":
        "What sport does Ashish play?",

    "gold_answer":
        "football",

    "evidence_quote":
        "Ashish plays football. He doesn’t play tennis.",

    "author_model":
        "verified_source_repair",

    "auto_validation":
        "PASS",

    "human_review_action":
        "VERIFIED_REPLACEMENT",
}

# Make sure it isn't already present.
existing_questions = {
    norm(item["question"])
    for item in kept
}

if norm(
    replacement["question"]
) in existing_questions:
    raise SystemExit(
        "STOP: Replacement question already exists."
    )

kept.append(replacement)


# ---------------------------------------------------------
# Verify exact 150 and 50/50/50.
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
        "STOP: Invalid distribution: "
        + repr(dict(counts))
    )


# ---------------------------------------------------------
# Check exact duplicate questions.
# ---------------------------------------------------------

question_map = {}

for item in kept:

    key = norm(
        item["question"]
    )

    if key in question_map:

        raise SystemExit(
            "STOP: Duplicate question remains:\n"
            + item["question"]
        )

    question_map[key] = True


# ---------------------------------------------------------
# Stable sort and renumber.
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
# Write V2R9.
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


new_sha = sha256_file(
    OUT
)


print()
print("=" * 78)
print("V2R9 CREATED")
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
    "Patched provenance:",
    len(PATCHES)
)

print(
    "Removed duplicate:",
    "CBQ-C7-008"
)

print(
    "Added replacement:",
    replacement["question"]
)

print()

print(
    "V2R9 SHA256:",
    new_sha
)

print(
    "Output:",
    OUT.relative_to(ROOT)
)

print()
print(
    "PASS: V2R8 preserved."
)

print(
    "NEXT: direct V2R9 audit."
)
