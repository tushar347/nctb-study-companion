from __future__ import annotations

import csv
import hashlib
import json
import re
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_sft_source_chunks_v2r3.jsonl"
)

OUT_DIR = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "sft"
)

REPORT_DIR = (
    ROOT
    / "research"
    / "reports"
    / "v2"
)

OUT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)

REPORT_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


MODEL = "gemma3:latest"
OLLAMA_URL = "http://127.0.0.1:11434"

TARGET_PER_PAIR = 12


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open(
        "rb"
    ) as f:

        for block in iter(
            lambda: f.read(1024 * 1024),
            b"",
        ):

            digest.update(block)

    return digest.hexdigest()


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


def normalize(text):

    text = str(
        text or ""
    ).casefold()

    text = (
        text
        .replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
        .replace("—", "-")
    )

    text = re.sub(
        r"[^a-z0-9]+",
        " ",
        text,
    )

    return " ".join(
        text.split()
    )


def normalized_contains(
    container,
    value,
):

    c = normalize(
        container
    )

    v = normalize(
        value
    )

    return (
        bool(v)
        and v in c
    )


def post_json(payload):

    request = urllib.request.Request(

        OLLAMA_URL + "/api/chat",

        data=json.dumps(
            payload,
            ensure_ascii=False,
        ).encode(
            "utf-8"
        ),

        headers={
            "Content-Type":
                "application/json"
        },

        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=300,
    ) as response:

        return json.loads(
            response.read().decode(
                "utf-8"
            )
        )


def parse_json(text):

    text = str(
        text or ""
    ).strip()

    try:

        return json.loads(
            text
        )

    except Exception:
        pass


    start = text.find(
        "{"
    )

    end = text.rfind(
        "}"
    )

    if (
        start >= 0
        and end > start
    ):

        try:

            return json.loads(
                text[
                    start:
                    end + 1
                ]
            )

        except Exception:
            pass


    return None


def build_prompt(
    record_a,
    record_b,
):

    source_a = record_a[
        "text"
    ]

    source_b = record_b[
        "text"
    ]

    return f"""
You are generating high-quality supervised fine-tuning data
for an NCTB English educational Small Language Model.

Create EXACTLY 12 training examples from the textbook source below.

Use ONLY information explicitly present in the sources.

Task distribution:

4 = short-answer QA
4 = multiple-choice questions
4 = passage-grounded QA

IMPORTANT:
- Do NOT create questions about page numbers.
- Do NOT create questions about formatting or headings.
- Do NOT invent facts.
- Do NOT use information outside the supplied textbook source.
- Keep questions appropriate for the textbook class level.
- Avoid duplicate questions.
- Gold answers must be supported by the source.
- For evidence_quote, copy an exact supporting quote from the source.
- Keep short answers concise.
- MCQ must have exactly 4 options.
- MCQ correct_answer must exactly match one option.
- Passage-grounded QA must quote supporting evidence.

Return JSON ONLY:

{{
  "examples": [
    {{
      "task_type": "short_qa",
      "question": "...?",
      "answer": "...",
      "evidence_quote": "exact source text"
    }},
    {{
      "task_type": "mcq",
      "question": "...?",
      "options": [
        "...",
        "...",
        "...",
        "..."
      ],
      "correct_answer": "...",
      "evidence_quote": "exact source text"
    }},
    {{
      "task_type": "passage_grounded_qa",
      "passage": "short source excerpt",
      "question": "...?",
      "answer": "...",
      "evidence_quote": "exact source text"
    }}
  ]
}}

SOURCE A
Book: {record_a["book_id"]}
Class: {record_a["class_level"]}
Pages: {record_a["page_start"]}-{record_a["page_end"]}

{source_a}


SOURCE B
Book: {record_b["book_id"]}
Class: {record_b["class_level"]}
Pages: {record_b["page_start"]}-{record_b["page_end"]}

{source_b}
""".strip()


def validate_example(
    item,
    source_text,
):

    if not isinstance(
        item,
        dict,
    ):

        return None, "not_object"


    task_type = str(
        item.get(
            "task_type",
            ""
        )
    ).strip()


    allowed = {
        "short_qa",
        "mcq",
        "passage_grounded_qa",
    }

    if task_type not in allowed:

        return None, "invalid_task_type"


    question = str(
        item.get(
            "question",
            ""
        )
    ).strip()


    if (
        len(question) < 10
        or len(question) > 300
    ):

        return None, "bad_question_length"


    if not question.endswith(
        "?"
    ):

        return None, "missing_question_mark"


    # Remove passage-dependent wording that makes
    # closed-style QA less useful.
    forbidden = [
        "according to the passage",
        "according to the text",
        "in the passage",
        "from the passage",
    ]

    if any(
        phrase in question.casefold()
        for phrase in forbidden
    ):

        return None, "passage_dependent_question"


    evidence = str(
        item.get(
            "evidence_quote",
            ""
        )
    ).strip()


    if not evidence:

        return None, "missing_evidence"


    if not normalized_contains(
        source_text,
        evidence,
    ):

        return None, "evidence_not_in_source"


    result = {
        "task_type":
            task_type,

        "question":
            question,

        "evidence_quote":
            evidence,
    }


    if task_type == "short_qa":

        answer = str(
            item.get(
                "answer",
                ""
            )
        ).strip()


        if not answer:

            return None, "empty_answer"


        if len(
            answer.split()
        ) > 25:

            return None, "answer_too_long"


        if not normalized_contains(
            evidence,
            answer,
        ):

            return None, "answer_not_in_evidence"


        result[
            "answer"
        ] = answer


    elif task_type == "mcq":

        options = item.get(
            "options"
        )

        correct = str(
            item.get(
                "correct_answer",
                ""
            )
        ).strip()


        if not isinstance(
            options,
            list
        ):

            return None, "options_not_list"


        if len(options) != 4:

            return None, "mcq_not_four_options"


        options = [
            str(x).strip()
            for x in options
        ]


        if len(
            set(
                map(
                    normalize,
                    options,
                )
            )
        ) != 4:

            return None, "duplicate_mcq_options"


        if correct not in options:

            return None, "correct_answer_not_option"


        if not normalized_contains(
            evidence,
            correct,
        ):

            return None, "mcq_answer_not_grounded"


        result[
            "options"
        ] = options


        result[
            "correct_answer"
        ] = correct


    else:

        passage = str(
            item.get(
                "passage",
                ""
            )
        ).strip()


        answer = str(
            item.get(
                "answer",
                ""
            )
        ).strip()


        if not passage:

            return None, "missing_passage"


        if not answer:

            return None, "empty_answer"


        if len(
            answer.split()
        ) > 25:

            return None, "answer_too_long"


        if not normalized_contains(
            source_text,
            passage,
        ):

            return None, "passage_not_in_source"


        if not normalized_contains(
            evidence,
            answer,
        ):

            return None, "grounded_answer_missing"


        result[
            "passage"
        ] = passage


        result[
            "answer"
        ] = answer


    return result, None


# ==========================================================
# Load SFT source
# ==========================================================

source_sha = sha256_file(
    SOURCE
)

records = load_jsonl(
    SOURCE
)


if len(records) != 202:

    raise SystemExit(
        f"Expected 202 SFT chunks, found {len(records)}."
    )


print()
print("=" * 78)
print("NCTB SFT DATASET GENERATION V2")
print("=" * 78)

print(
    "Source chunks:",
    len(records)
)

print(
    "Source SHA256:",
    source_sha
)

print(
    "Generator:",
    MODEL
)

print(
    "Target:",
    "~1,200 examples"
)

print()


# ==========================================================
# Group chunks by class and pair them.
# ==========================================================

by_class = defaultdict(
    list
)

for record in records:

    by_class[
        int(
            record[
                "class_level"
            ]
        )
    ].append(
        record
    )


pairs = []

for class_level in (
    6,
    7,
    8,
):

    rows = by_class[
        class_level
    ]

    for i in range(
        0,
        len(rows),
        2
    ):

        if i + 1 < len(rows):

            pairs.append(
                (
                    rows[i],
                    rows[i + 1],
                )
            )

        else:

            pairs.append(
                (
                    rows[i],
                    rows[i],
                )
            )


print(
    "Generation calls:",
    len(pairs)
)

print()


# ==========================================================
# Generate
# ==========================================================

examples = []

rejections = Counter()

seen_questions = set()


for index, (
    record_a,
    record_b,
) in enumerate(
    pairs,
    start=1,
):

    class_level = int(
        record_a[
            "class_level"
        ]
    )

    print(
        f"[{index:03d}/{len(pairs)}] "
        f"Class {class_level} "
        f"{record_a['chunk_id']} + "
        f"{record_b['chunk_id']}"
    )


    prompt = build_prompt(
        record_a,
        record_b,
    )


    payload = {
        "model":
            MODEL,

        "stream":
            False,

        "format":
            "json",

        "messages": [
            {
                "role":
                    "user",

                "content":
                    prompt,
            }
        ],

        "options": {
            "temperature":
                0.15,

            "seed":
                15000 + index,

            "num_predict":
                1800,
        },
    }


    try:

        response = post_json(
            payload
        )

    except Exception as exc:

        print(
            "   ERROR:",
            exc
        )

        continue


    raw = (
        response
        .get(
            "message",
            {}
        )
        .get(
            "content",
            ""
        )
    )


    parsed = parse_json(
        raw
    )


    if not isinstance(
        parsed,
        dict,
    ):

        rejections[
            "invalid_json"
        ] += 1

        print(
            "   invalid JSON"
        )

        continue


    generated = parsed.get(
        "examples",
        []
    )


    if not isinstance(
        generated,
        list,
    ):

        rejections[
            "missing_examples"
        ] += 1

        continue


    combined_source = (
        record_a[
            "text"
        ]
        + "\n"
        + record_b[
            "text"
        ]
    )


    accepted_this_call = 0


    for item in generated:

        clean, reason = (
            validate_example(
                item,
                combined_source,
            )
        )


        if clean is None:

            rejections[
                reason
            ] += 1

            continue


        qkey = normalize(
            clean[
                "question"
            ]
        )


        if qkey in seen_questions:

            rejections[
                "duplicate_question"
            ] += 1

            continue


        seen_questions.add(
            qkey
        )


        clean[
            "class_level"
        ] = class_level

        clean[
            "book_id"
        ] = record_a[
            "book_id"
        ]

        clean[
            "source_chunk_ids"
        ] = [
            record_a[
                "chunk_id"
            ]
        ]


        if (
            record_b[
                "chunk_id"
            ]
            != record_a[
                "chunk_id"
            ]
        ):

            clean[
                "source_chunk_ids"
            ].append(
                record_b[
                    "chunk_id"
                ]
            )


        clean[
            "source_pages"
        ] = (
            f"{record_a['page_start']}-"
            f"{record_b['page_end']}"
        )


        clean[
            "source_sha256"
        ] = hashlib.sha256(
            combined_source.encode(
                "utf-8"
            )
        ).hexdigest()


        clean[
            "generator"
        ] = MODEL


        clean[
            "status"
        ] = "candidate"


        examples.append(
            clean
        )


        accepted_this_call += 1


    print(
        "   accepted:",
        accepted_this_call
    )


# ==========================================================
# Stable IDs
# ==========================================================

examples.sort(
    key=lambda x: (
        int(
            x[
                "class_level"
            ]
        ),

        str(
            x[
                "source_chunk_ids"
            ]
        ),

        normalize(
            x[
                "question"
            ]
        ),
    )
)


for number, item in enumerate(
    examples,
    start=1,
):

    item[
        "example_id"
    ] = (
        f"NCTB-SFT-{number:05d}"
    )


# ==========================================================
# Save candidate dataset
# ==========================================================

candidate_path = (
    OUT_DIR
    / "nctb_sft_candidates_v2r4.jsonl"
)

with candidate_path.open(
    "w",
    encoding="utf-8",
) as f:

    for item in examples:

        f.write(
            json.dumps(
                item,
                ensure_ascii=False,
            )
            + "\n"
        )


# ==========================================================
# CSV review file
# ==========================================================

review_path = (
    OUT_DIR
    / "nctb_sft_candidates_v2r4_review.csv"
)


fields = [
    "example_id",
    "class_level",
    "book_id",
    "source_chunk_ids",
    "task_type",
    "question",
    "answer",
    "options",
    "correct_answer",
    "passage",
    "evidence_quote",
    "status",
    "human_decision",
    "review_notes",
]


with review_path.open(
    "w",
    encoding="utf-8-sig",
    newline="",
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=fields,
    )

    writer.writeheader()


    for item in examples:

        writer.writerow(
            {
                "example_id":
                    item.get(
                        "example_id",
                        ""
                    ),

                "class_level":
                    item.get(
                        "class_level",
                        ""
                    ),

                "book_id":
                    item.get(
                        "book_id",
                        ""
                    ),

                "source_chunk_ids":
                    ";".join(
                        item.get(
                            "source_chunk_ids",
                            []
                        )
                    ),

                "task_type":
                    item.get(
                        "task_type",
                        ""
                    ),

                "question":
                    item.get(
                        "question",
                        ""
                    ),

                "answer":
                    item.get(
                        "answer",
                        ""
                    ),

                "options":
                    " | ".join(
                        item.get(
                            "options",
                            []
                        )
                    ),

                "correct_answer":
                    item.get(
                        "correct_answer",
                        ""
                    ),

                "passage":
                    item.get(
                        "passage",
                        ""
                    ),

                "evidence_quote":
                    item.get(
                        "evidence_quote",
                        ""
                    ),

                "status":
                    item.get(
                        "status",
                        ""
                    ),

                "human_decision":
                    "",

                "review_notes":
                    "",
            }
        )


# ==========================================================
# Statistics
# ==========================================================

class_counts = Counter(
    int(
        item[
            "class_level"
        ]
    )
    for item in examples
)


task_counts = Counter(
    item[
        "task_type"
    ]
    for item in examples
)


summary = {
    "version":
        "nctb-sft-candidates-v2r4",

    "source_file":
        str(
            SOURCE.relative_to(
                ROOT
            )
        ),

    "source_sha256":
        source_sha,

    "source_chunks":
        len(records),

    "generation_calls":
        len(pairs),

    "generated_examples":
        len(examples),

    "class_distribution": {
        "6":
            class_counts[6],

        "7":
            class_counts[7],

        "8":
            class_counts[8],
    },

    "task_distribution":
        dict(task_counts),

    "rejection_reasons":
        dict(rejections),

    "candidate_sha256":
        sha256_file(
            candidate_path
        ),

    "important":
        (
            "Candidate SFT dataset only. "
            "Not yet locked for training."
        ),
}


summary_path = (
    REPORT_DIR
    / "nctb_sft_candidates_v2r4_summary.json"
)


summary_path.write_text(
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
print("SFT CANDIDATE GENERATION COMPLETE")
print("=" * 78)

print(
    "Generated examples:",
    len(examples)
)

print()

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

print()

print(
    "Task distribution:"
)

for task, count in (
    task_counts.items()
):

    print(
        f"  {task}: {count}"
    )

print()

print(
    "Rejected candidates:"
)

for reason, count in (
    rejections.most_common()
):

    print(
        f"  {reason}: {count}"
    )

print()

print(
    "Candidate SHA256:",
    summary[
        "candidate_sha256"
    ]
)

print()

print(
    "Dataset:",
    candidate_path.relative_to(
        ROOT
    )
)

print(
    "Review CSV:",
    review_path.relative_to(
        ROOT
    )
)

print(
    "Summary:",
    summary_path.relative_to(
        ROOT
    )
)

print()
print(
    "NEXT: run SFT automatic quality audit."
)
