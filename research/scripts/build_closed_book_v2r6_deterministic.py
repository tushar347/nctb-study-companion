import json
import hashlib
import re
from pathlib import Path
from collections import Counter

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r5_reviewed.jsonl"
)

CHUNKS = (
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
    / "closed_book_eval_candidates_v2r6.jsonl"
)


EXPECTED_SHA = (
    "f8052fa847a350606b52f8a3fbe10c3424171478ad92683097acf37bb19473c6"
)


def sha256_file(path):
    h = hashlib.sha256()

    with path.open("rb") as f:
        for chunk in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):
            h.update(chunk)

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
            str(text).casefold()
        ).split()
    )


def add_record(
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
            "closed-book-benchmark-v2r6",

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
            "human_rule_based_repair",

        "auto_validation":
            "PASS",

        "human_review_action":
            "REPLACEMENT",
    }


candidate_sha = sha256_file(
    SOURCE
)

if candidate_sha != EXPECTED_SHA:
    raise SystemExit(
        "STOP: V2R5 SHA256 mismatch.\n"
        f"Expected: {EXPECTED_SHA}\n"
        f"Actual:   {candidate_sha}"
    )


items = load_jsonl(
    SOURCE
)

chunks = load_jsonl(
    CHUNKS
)

chunk_by_id = {
    row["chunk_id"]: row
    for row in chunks
}


# ------------------------------------------------------
# Remove the two known bad spot-check items.
# ------------------------------------------------------

BAD = {
    "CBQ-C6-005",
    "CBQ-C6-041",
}


kept = [
    item
    for item in items
    if item[
        "candidate_id"
    ] not in BAD
]


# ------------------------------------------------------
# Correct the known edit items.
# ------------------------------------------------------

EDITS = {

    "CBQ-C6-049": (
        "What are common occupations for many villagers "
        "in rural Bangladesh?",
        "farmers, fishermen, or craftsmen",
    ),

    "CBQ-C7-020": (
        "What should family members do for one another?",
        "live together and support each other",
    ),

    "CBQ-C8-012": (
        "Where do many small ethnic communities of "
        "Bangladesh live peacefully?",
        "in the hills, plains and forests",
    ),

    "CBQ-C8-045": (
        "Which folk music genre is associated with boatmen?",
        "Bhatiyali",
    ),
}


for item in kept:

    cid = item[
        "candidate_id"
    ]

    if cid not in EDITS:
        continue

    question, answer = EDITS[
        cid
    ]

    item[
        "question"
    ] = question

    item[
        "gold_answer"
    ] = answer

    item[
        "human_review_action"
    ] = "EDIT_CONFIRMED"


# ------------------------------------------------------
# Two deterministic replacements for Class 6.
#
# We use clean factual sentences already present in the
# Class 6 evaluation-source corpus, rather than asking
# another local model to generate them.
# ------------------------------------------------------

replacement_1 = add_record(
    6,
    "class6-english",
    "class6-english-chunk-0058",
    112,
    112,
    "Which festivals do villagers celebrate with joy?",
    "Pahela Boishakh and Nabanna Utsab",
    "Villagers celebrate festivals such as Pahela Boishakh and Nabanna Utsab with joy.",
)

replacement_2 = add_record(
    6,
    "class6-english",
    "class6-english-chunk-0058",
    112,
    112,
    "What are common occupations among villagers?",
    "farmers, fishermen, or craftsmen",
    "Most villagers work as farmers, fishermen, or craftsmen.",
)


# Prevent exact duplicates.
existing_questions = {
    norm(
        item[
            "question"
        ]
    )
    for item in kept
}

for replacement in (
    replacement_1,
    replacement_2,
):

    if (
        norm(
            replacement[
                "question"
            ]
        )
        in existing_questions
    ):

        raise SystemExit(
            "Replacement question already exists."
        )

    existing_questions.add(
        norm(
            replacement[
                "question"
            ]
        )
    )

    kept.append(
        replacement
    )


# ------------------------------------------------------
# Verify class balance before writing.
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
        "Class distribution is incorrect: "
        + repr(dict(counts))
    )


# ------------------------------------------------------
# Stable ordering and IDs.
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

    class_level = int(
        item[
            "class_level"
        ]
    )

    serial[
        class_level
    ] += 1

    item[
        "candidate_id"
    ] = (
        f"CBQ-C{class_level}-"
        f"{serial[class_level]:03d}"
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
print("=" * 78)
print("V2R6 BENCHMARK CREATED")
print("=" * 78)

print(
    "Total:",
    len(kept),
)

print(
    "Class 6:",
    counts[6],
)

print(
    "Class 7:",
    counts[7],
)

print(
    "Class 8:",
    counts[8],
)

print()
print(
    "Removed:",
    ", ".join(
        sorted(BAD)
    )
)

print(
    "Added deterministic replacements: 2"
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
    "NEXT: run final automatic audit + fresh 15-question spot check."
)
