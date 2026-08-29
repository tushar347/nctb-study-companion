from __future__ import annotations

import csv
import hashlib
import json
import os
import random
import re
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

BENCHMARK = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
    / "closed_book_eval_candidates_v2r5_reviewed.jsonl"
)

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)

OUT_DIR = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "evaluation"
)

REPORT_DIR = (
    ROOT
    / "research"
    / "reports"
    / "v2"
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)

OLLAMA_URL = os.getenv(
    "OLLAMA_BASE_URL",
    "http://127.0.0.1:11434"
).rstrip("/")

MODELS = [
    "gemma3:latest",
    "qwen3:latest",
]

RANDOM_SAMPLE_PER_CLASS = 5

RANDOM_SEED = 20260812


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as f:
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


def normalize_space(text):
    return re.sub(
        r"\s+",
        " ",
        str(text or ""),
    ).strip()


def post_json(url, payload):
    request = urllib.request.Request(
        url,
        data=json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8"),
        headers={
            "Content-Type":
                "application/json"
        },
        method="POST",
    )

    with urllib.request.urlopen(
        request,
        timeout=180,
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
        return json.loads(text)
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if (
        start >= 0
        and end > start
    ):

        try:
            return json.loads(
                text[start:end + 1]
            )
        except Exception:
            pass

    return None


def judge_prompt(
    item,
    source_text,
):

    return f"""
You are an independent evaluator for a research benchmark
for an NCTB English educational SLM.

Evaluate ONE closed-book benchmark item.

At real evaluation time, the model will receive ONLY the QUESTION.
It will NOT receive the source passage.

Check these five things:

1. self_contained:
   Can the question be understood without seeing the source?

2. answer_correct:
   Does the gold answer directly answer the question?

3. evidence_supports_answer:
   Does the source evidence support the gold answer?

4. unambiguous:
   Is there one clear intended answer?

5. benchmark_suitable:
   Is this a useful factual/textbook question for a Class
   {item["class_level"]} NCTB English benchmark?

Do NOT judge based on whether the question is beautifully written.
Focus on correctness and evaluation quality.

IMPORTANT:
- Do not invent facts.
- Do not change the gold answer.
- Do not rely on information outside the provided source.

Return JSON ONLY:

{{
  "self_contained": true,
  "answer_correct": true,
  "evidence_supports_answer": true,
  "unambiguous": true,
  "benchmark_suitable": true,
  "decision": "PASS",
  "reason": "brief reason"
}}

QUESTION:
{item["question"]}

GOLD ANSWER:
{item["gold_answer"]}

EVIDENCE:
{item["evidence_quote"]}

SOURCE TEXT:
{source_text}
""".strip()


def run_judge(
    model,
    item,
    source_text,
):

    payload = {
        "model":
            model,

        "stream":
            False,

        "format":
            "json",

        "messages": [
            {
                "role":
                    "user",

                "content":
                    judge_prompt(
                        item,
                        source_text,
                    ),
            }
        ],

        "options": {
            "temperature":
                0.0,

            "seed":
                8000,

            "num_predict":
                350,
        },
    }

    response = post_json(
        OLLAMA_URL
        + "/api/chat",
        payload,
    )

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

        return {
            "decision":
                "ERROR",

            "reason":
                "Judge did not return valid JSON.",
        }

    required = [
        "self_contained",
        "answer_correct",
        "evidence_supports_answer",
        "unambiguous",
        "benchmark_suitable",
    ]

    for field in required:

        if field not in parsed:

            return {
                "decision":
                    "ERROR",

                "reason":
                    f"Missing field: {field}",
            }

    values = [
        bool(
            parsed[field]
        )
        for field in required
    ]

    decision = str(
        parsed.get(
            "decision",
            ""
        )
    ).upper().strip()

    if all(values) and decision == "PASS":
        final = "PASS"
    else:
        final = "FAIL"

    return {
        "self_contained":
            bool(
                parsed[
                    "self_contained"
                ]
            ),

        "answer_correct":
            bool(
                parsed[
                    "answer_correct"
                ]
            ),

        "evidence_supports_answer":
            bool(
                parsed[
                    "evidence_supports_answer"
                ]
            ),

        "unambiguous":
            bool(
                parsed[
                    "unambiguous"
                ]
            ),

        "benchmark_suitable":
            bool(
                parsed[
                    "benchmark_suitable"
                ]
            ),

        "decision":
            final,

        "reason":
            normalize_space(
                parsed.get(
                    "reason",
                    ""
                )
            ),
    }


# ----------------------------------------------------------
# Load data
# ----------------------------------------------------------

benchmark = load_jsonl(
    BENCHMARK
)

source_chunks = load_jsonl(
    SOURCE
)

source_by_id = {
    row["chunk_id"]:
        row
    for row in source_chunks
}

print()
print("=" * 78)
print("DUAL-MODEL CLOSED-BOOK BENCHMARK VERIFICATION")
print("=" * 78)

print(
    "Benchmark items:",
    len(benchmark)
)

print(
    "Models:",
    ", ".join(MODELS)
)

print()


# ----------------------------------------------------------
# Create deterministic 15-question spot check
# ----------------------------------------------------------

rng = random.Random(
    RANDOM_SEED
)

spot_check_ids = set()

for class_level in (
    6,
    7,
    8,
):

    class_items = [
        item
        for item in benchmark
        if int(
            item["class_level"]
        ) == class_level
    ]

    chosen = rng.sample(
        class_items,
        RANDOM_SAMPLE_PER_CLASS,
    )

    for item in chosen:
        spot_check_ids.add(
            item[
                "candidate_id"
            ]
        )


results = []

status_counts = Counter()


for index, item in enumerate(
    benchmark,
    start=1,
):

    source = source_by_id.get(
        item[
            "chunk_id"
        ]
    )

    source_text = ""

    if source:
        source_text = source[
            "text"
        ]

    print(
        f"[{index:03d}/{len(benchmark)}] "
        f"{item['candidate_id']}"
    )

    model_results = {}

    for model in MODELS:

        print(
            "   judging:",
            model,
            end=" ... ",
            flush=True,
        )

        try:

            judged = run_judge(
                model,
                item,
                source_text,
            )

            model_results[
                model
            ] = judged

            print(
                judged[
                    "decision"
                ]
            )

        except Exception as exc:

            model_results[
                model
            ] = {
                "decision":
                    "ERROR",

                "reason":
                    repr(exc),
            }

            print(
                "ERROR"
            )


    gemma_decision = model_results[
        MODELS[0]
    ]["decision"]

    qwen_decision = model_results[
        MODELS[1]
    ]["decision"]


    both_pass = (
        gemma_decision == "PASS"
        and qwen_decision == "PASS"
    )

    both_fail = (
        gemma_decision == "FAIL"
        and qwen_decision == "FAIL"
    )

    disagreement = (
        gemma_decision
        != qwen_decision
        or gemma_decision == "ERROR"
        or qwen_decision == "ERROR"
    )


    if disagreement:
        final_status = (
            "HUMAN_REVIEW"
        )

    elif both_pass:
        final_status = (
            "AUTO_ACCEPT"
        )

    elif both_fail:
        final_status = (
            "HUMAN_REVIEW"
        )

    else:
        final_status = (
            "HUMAN_REVIEW"
        )


    # Spot-check even items where both models agree.
    if (
        item[
            "candidate_id"
        ]
        in spot_check_ids
        and final_status
        == "AUTO_ACCEPT"
    ):

        final_status = (
            "SPOT_CHECK"
        )


    status_counts[
        final_status
    ] += 1


    results.append(
        {
            "candidate_id":
                item[
                    "candidate_id"
                ],

            "class_level":
                item[
                    "class_level"
                ],

            "question":
                item[
                    "question"
                ],

            "gold_answer":
                item[
                    "gold_answer"
                ],

            "evidence_quote":
                item[
                    "evidence_quote"
                ],

            "gemma_decision":
                gemma_decision,

            "gemma_reason":
                model_results[
                    MODELS[0]
                ].get(
                    "reason",
                    ""
                ),

            "qwen_decision":
                qwen_decision,

            "qwen_reason":
                model_results[
                    MODELS[1]
                ].get(
                    "reason",
                    ""
                ),

            "final_status":
                final_status,

            "spot_check":
                (
                    item[
                        "candidate_id"
                    ]
                    in spot_check_ids
                ),
        }
    )


# ----------------------------------------------------------
# Save results
# ----------------------------------------------------------

AUDIT_CSV = (
    OUT_DIR
    / "closed_book_eval_dual_judge_v2r5.csv"
)

FIELDS = [
    "candidate_id",
    "class_level",
    "question",
    "gold_answer",
    "evidence_quote",
    "gemma_decision",
    "gemma_reason",
    "qwen_decision",
    "qwen_reason",
    "final_status",
    "spot_check",
]


with AUDIT_CSV.open(
    "w",
    encoding="utf-8-sig",
    newline="",
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=FIELDS,
    )

    writer.writeheader()

    writer.writerows(
        results
    )


human_review = [
    row
    for row in results
    if row[
        "final_status"
    ] in {
        "HUMAN_REVIEW",
        "SPOT_CHECK",
    }
]


HUMAN_CSV = (
    OUT_DIR
    / "closed_book_eval_targeted_human_review_v2r5.csv"
)


with HUMAN_CSV.open(
    "w",
    encoding="utf-8-sig",
    newline="",
) as f:

    writer = csv.DictWriter(
        f,
        fieldnames=FIELDS,
    )

    writer.writeheader()

    writer.writerows(
        human_review
    )


SUMMARY = (
    REPORT_DIR
    / "closed_book_eval_dual_judge_v2r5_summary.json"
)


summary = {
    "benchmark_sha256":
        sha256_file(
            BENCHMARK
        ),

    "benchmark_count":
        len(benchmark),

    "judge_models":
        MODELS,

    "random_seed":
        RANDOM_SEED,

    "spot_check_per_class":
        RANDOM_SAMPLE_PER_CLASS,

    "spot_check_total":
        len(
            spot_check_ids
        ),

    "status_counts":
        dict(
            status_counts
        ),

    "human_review_count":
        len(
            human_review
        ),

    "audit_csv":
        str(
            AUDIT_CSV.relative_to(
                ROOT
            )
        ),

    "human_review_csv":
        str(
            HUMAN_CSV.relative_to(
                ROOT
            )
        ),
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
print("DUAL-JUDGE VERIFICATION COMPLETE")
print("=" * 78)

print(
    "Benchmark:",
    len(benchmark)
)

print()

for status, count in (
    status_counts.items()
):

    print(
        f"{status}: {count}"
    )

print()

print(
    "Targeted human review:",
    len(human_review)
)

print(
    "Random spot-check:",
    len(
        spot_check_ids
    )
)

print()

print(
    "Audit CSV:",
    AUDIT_CSV.relative_to(
        ROOT
    )
)

print(
    "Human review CSV:",
    HUMAN_CSV.relative_to(
        ROOT
    )
)

print(
    "Summary:",
    SUMMARY.relative_to(
        ROOT
    )
)

print()
print(
    "IMPORTANT:"
)

print(
    "AUTO_ACCEPT means both independent local judges agreed."
)

print(
    "SPOT_CHECK means the item was randomly sampled."
)

print(
    "HUMAN_REVIEW contains disagreements, failures, and spot-checks."
)
