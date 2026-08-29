from __future__ import annotations

import csv
import json
import textwrap
from collections import Counter
from pathlib import Path


CSV_PATH = Path(
    "research/data/processed/"
    "pilot_sft_quality_audit_v2.csv"
)


def save_rows(
    rows: list[dict[str, str]],
    fieldnames: list[str],
) -> None:
    with CSV_PATH.open(
        "w",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=fieldnames,
        )

        writer.writeheader()
        writer.writerows(rows)


def print_wrapped(
    label: str,
    value: str,
    width: int = 100,
) -> None:
    value = value.strip()

    if not value:
        return

    print(f"\n{label}:")

    for line in textwrap.wrap(
        value,
        width=width,
        replace_whitespace=False,
    ):
        print(f"  {line}")


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(
            f"Review CSV not found: {CSV_PATH}",
        )

    with CSV_PATH.open(
        "r",
        encoding="utf-8-sig",
        newline="",
    ) as handle:
        reader = csv.DictReader(handle)

        fieldnames = list(
            reader.fieldnames or [],
        )

        rows = list(reader)

    required_columns = {
        "example_id",
        "task",
        "question",
        "answer",
        "evidence_quote",
        "automatic_decision",
        "human_decision",
        "reviewer",
        "corrected_question",
        "corrected_output_json",
        "notes",
    }

    missing = (
        required_columns
        - set(fieldnames)
    )

    if missing:
        raise RuntimeError(
            "Missing CSV columns: "
            + ", ".join(sorted(missing)),
        )

    reviewer = input(
        "Reviewer name: ",
    ).strip()

    if not reviewer:
        reviewer = "Project reviewer"

    print()
    print("PILOT SFT HUMAN REVIEW")
    print("=" * 72)
    print("A = Accept")
    print("C = Correct question")
    print("R = Reject")
    print("S = Skip for now")
    print("Q = Save and quit")

    for index, row in enumerate(
        rows,
        start=1,
    ):
        if row.get(
            "human_decision",
            "",
        ).strip():
            continue

        print()
        print("=" * 72)
        print(
            f"RECORD {index}/{len(rows)}",
        )
        print("=" * 72)

        print(
            f"Example ID: "
            f"{row.get('example_id', '')}",
        )

        print(
            f"Task: "
            f"{row.get('task', '')}",
        )

        print(
            f"Book: "
            f"{row.get('book_id', '')}",
        )

        print(
            f"Page: "
            f"{row.get('page_number', '')}",
        )

        print(
            f"Automatic decision: "
            f"{row.get('automatic_decision', '')}",
        )

        print_wrapped(
            "Question",
            row.get(
                "question",
                "",
            ),
        )

        print_wrapped(
            "Options",
            row.get(
                "options",
                "",
            ),
        )

        print_wrapped(
            "Answer",
            row.get(
                "answer",
                "",
            ),
        )

        print_wrapped(
            "Evidence",
            row.get(
                "evidence_quote",
                "",
            ),
        )

        print_wrapped(
            "Hard errors",
            row.get(
                "hard_errors",
                "",
            ),
        )

        print_wrapped(
            "Warnings",
            row.get(
                "warnings",
                "",
            ),
        )

        print_wrapped(
            "Source preview",
            row.get(
                "source_preview",
                "",
            ),
        )

        while True:
            choice = input(
                "\nDecision [A/C/R/S/Q]: ",
            ).strip().upper()

            if choice in {
                "A",
                "C",
                "R",
                "S",
                "Q",
            }:
                break

            print(
                "Enter A, C, R, S or Q.",
            )

        if choice == "Q":
            save_rows(
                rows,
                fieldnames,
            )

            print(
                "\nReview saved. Exiting.",
            )

            return

        if choice == "S":
            continue

        row["reviewer"] = reviewer

        if choice == "A":
            row["human_decision"] = (
                "ACCEPT"
            )

            note = input(
                "Optional note: ",
            ).strip()

            row["notes"] = note

        elif choice == "R":
            row["human_decision"] = (
                "REJECT"
            )

            reason = input(
                "Reason for rejection: ",
            ).strip()

            row["notes"] = (
                reason
                or "Rejected during human review."
            )

        elif choice == "C":
            row["human_decision"] = (
                "CORRECT"
            )

            print(
                "\nOriginal question:",
            )

            print(
                row.get(
                    "question",
                    "",
                ),
            )

            corrected_question = input(
                "\nCorrected question: ",
            ).strip()

            if not corrected_question:
                print(
                    "A corrected question is required.",
                )

                row["human_decision"] = ""
                row["reviewer"] = ""

                continue

            row[
                "corrected_question"
            ] = corrected_question

            correction_note = input(
                "Correction note: ",
            ).strip()

            row["notes"] = (
                correction_note
                or "Question wording corrected."
            )

        save_rows(
            rows,
            fieldnames,
        )

        print(
            "Decision saved.",
        )

    save_rows(
        rows,
        fieldnames,
    )

    decisions = Counter(
        (
            row.get(
                "human_decision",
                "",
            ).strip()
            or "UNREVIEWED"
        )
        for row in rows
    )

    print()
    print("=" * 72)
    print("REVIEW COMPLETE")
    print("=" * 72)

    for decision, count in sorted(
        decisions.items(),
    ):
        print(
            f"{decision}: {count}",
        )

    print()
    print(
        f"Saved to: {CSV_PATH.resolve()}",
    )


if __name__ == "__main__":
    main()
