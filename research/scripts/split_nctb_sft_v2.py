import json
import hashlib
import random
from pathlib import Path
from collections import Counter, defaultdict

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "sft"
    / "nctb_sft_candidates_v2r4.jsonl"
)

OUT_DIR = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "sft"
    / "final_v2"
)

OUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

TRAIN = OUT_DIR / "nctb_sft_train_v2.jsonl"
VAL = OUT_DIR / "nctb_sft_validation_v2.jsonl"
SUMMARY = OUT_DIR / "nctb_sft_split_v2_summary.json"


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
                rows.append(json.loads(line))

    return rows


rows = load_jsonl(SOURCE)

if len(rows) != 340:
    raise SystemExit(
        f"Expected 340 rows, found {len(rows)}"
    )


# ------------------------------------------------------
# Keep only AUTO-PASS items.
# ------------------------------------------------------

rows = [
    row
    for row in rows
    if row.get("status") == "candidate"
]


if len(rows) != 340:
    raise SystemExit(
        f"Expected all 340 candidates to be clean, found {len(rows)}"
    )


# ------------------------------------------------------
# Deterministic grouped split.
# Same source chunk must not appear in both train/val.
# ------------------------------------------------------

rng = random.Random(20260812)

by_class = defaultdict(list)

for row in rows:
    by_class[
        int(row["class_level"])
    ].append(row)


train = []
val = []


for class_level in (6, 7, 8):

    class_rows = by_class[class_level]

    # Group by source chunk pair.
    groups = defaultdict(list)

    for row in class_rows:

        key = tuple(
            row.get(
                "source_chunk_ids",
                []
            )
        )

        groups[key].append(row)


    groups_list = list(groups.items())

    rng.shuffle(groups_list)


    # Target ~15% validation.
    target_val = max(
        1,
        round(
            len(class_rows) * 0.15
        )
    )

    val_count = 0

    for source_group, group_rows in groups_list:

        if val_count < target_val:

            val.extend(group_rows)

            val_count += len(group_rows)

        else:

            train.extend(group_rows)


# ------------------------------------------------------
# Safety checks
# ------------------------------------------------------

train_ids = {
    row["example_id"]
    for row in train
}

val_ids = {
    row["example_id"]
    for row in val
}


if train_ids & val_ids:
    raise SystemExit(
        "STOP: example overlap between train and validation."
    )


train_chunks = set()

for row in train:
    train_chunks.update(
        row.get(
            "source_chunk_ids",
            []
        )
    )


val_chunks = set()

for row in val:
    val_chunks.update(
        row.get(
            "source_chunk_ids",
            []
        )
    )


chunk_overlap = (
    train_chunks & val_chunks
)


if chunk_overlap:
    raise SystemExit(
        "STOP: source chunk overlap between train and validation:\n"
        + repr(
            sorted(chunk_overlap)
        )
    )


# ------------------------------------------------------
# Stable order
# ------------------------------------------------------

train.sort(
    key=lambda x: x["example_id"]
)

val.sort(
    key=lambda x: x["example_id"]
)


# ------------------------------------------------------
# Write
# ------------------------------------------------------

with TRAIN.open(
    "w",
    encoding="utf-8",
) as f:

    for row in train:

        f.write(
            json.dumps(
                row,
                ensure_ascii=False,
            )
            + "\n"
        )


with VAL.open(
    "w",
    encoding="utf-8",
) as f:

    for row in val:

        f.write(
            json.dumps(
                row,
                ensure_ascii=False,
            )
            + "\n"
        )


# ------------------------------------------------------
# Summary
# ------------------------------------------------------

train_class = Counter(
    int(row["class_level"])
    for row in train
)

val_class = Counter(
    int(row["class_level"])
    for row in val
)

train_task = Counter(
    row["task_type"]
    for row in train
)

val_task = Counter(
    row["task_type"]
    for row in val
)


summary = {
    "source_sha256":
        sha256_file(SOURCE),

    "source_examples":
        len(rows),

    "train_examples":
        len(train),

    "validation_examples":
        len(val),

    "train_validation_example_overlap":
        len(
            train_ids & val_ids
        ),

    "train_validation_source_chunk_overlap":
        len(
            chunk_overlap
        ),

    "train_class_distribution":
        dict(train_class),

    "validation_class_distribution":
        dict(val_class),

    "train_task_distribution":
        dict(train_task),

    "validation_task_distribution":
        dict(val_task),

    "train_sha256":
        sha256_file(TRAIN),

    "validation_sha256":
        sha256_file(VAL),
}


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
print("V2 SFT TRAIN / VALIDATION SPLIT CREATED")
print("=" * 78)

print(
    "Total examples:",
    len(rows)
)

print(
    "Train:",
    len(train)
)

print(
    "Validation:",
    len(val)
)

print()

print(
    "Train/validation example overlap:",
    len(train_ids & val_ids)
)

print(
    "Train/validation source chunk overlap:",
    len(chunk_overlap)
)

print()

print(
    "TRAIN CLASS:",
    dict(train_class)
)

print(
    "VAL CLASS:",
    dict(val_class)
)

print()

print(
    "Train SHA256:",
    summary["train_sha256"]
)

print(
    "Validation SHA256:",
    summary["validation_sha256"]
)

print()

print(
    "Train:",
    TRAIN.relative_to(ROOT)
)

print(
    "Validation:",
    VAL.relative_to(ROOT)
)

print(
    "Summary:",
    SUMMARY.relative_to(ROOT)
)

print()
print(
    "PASS: Split is ready for Kaggle."
)
