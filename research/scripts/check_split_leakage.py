import csv
from collections import defaultdict
from pathlib import Path

path = Path(
    "research/data/splits/"
    "split_metadata_v1.csv"
)

groups = defaultdict(set)

with path.open(
    "r",
    encoding="utf-8-sig",
    newline="",
) as handle:
    for row in csv.DictReader(handle):
        groups[
            row["split_group"]
        ].add(
            row["split"],
        )

leaking = {
    group: sorted(splits)
    for group, splits
    in groups.items()
    if len(splits) > 1
}

print()
print("SPLIT LEAKAGE CHECK")
print("=" * 60)
print(
    "Groups checked:",
    len(groups),
)
print(
    "Leaking groups:",
    len(leaking),
)

if leaking:
    for group, splits in (
        leaking.items()
    ):
        print(
            group,
            splits,
        )

    raise SystemExit(1)

print(
    "PASS: No lesson or page-block "
    "appears in multiple splits.",
)
