from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(r"D:\nctb-study-companion-starter")

SOURCE = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "training_ready"
    / "nctb_english_classes_6_7_8_training_ready_v2r2.jsonl"
)

OUT_DIR = (
    ROOT
    / "research"
    / "data"
    / "v2"
    / "chunks"
)

REPORT_DIR = (
    ROOT
    / "research"
    / "reports"
    / "v2"
)

SCRIPT_DIR = (
    ROOT
    / "research"
    / "scripts"
)

OUT_DIR.mkdir(parents=True, exist_ok=True)
REPORT_DIR.mkdir(parents=True, exist_ok=True)
SCRIPT_DIR.mkdir(parents=True, exist_ok=True)

VERSION = "nctb-semantic-chunks-v2r3"

MIN_WORDS = 160
TARGET_WORDS = 300
MAX_WORDS = 420

# 20% of chunks are reserved as sources for
# CLOSED-BOOK evaluation-question creation.
# They may still be used in Stage-A full-book adaptation,
# but NEVER for Stage-B supervised QA/MCQ generation.
EVAL_SOURCE_FRACTION = 0.20

BOOKS = {
    "class6-english": 6,
    "class7-english": 7,
    "class8-english": 8,
}


def sha256_text(text):
    return hashlib.sha256(
        text.encode("utf-8")
    ).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()

    with path.open("rb") as handle:
        for chunk in iter(
            lambda: handle.read(
                1024 * 1024
            ),
            b"",
        ):
            digest.update(chunk)

    return digest.hexdigest()


def normalize_text(text):
    text = str(text or "")

    text = text.replace(
        "\r\n",
        "\n"
    ).replace(
        "\r",
        "\n"
    )

    text = re.sub(
        r"[ \t]+",
        " ",
        text
    )

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text
    )

    return text.strip()


def split_long_words(words):
    pieces = []

    for start in range(
        0,
        len(words),
        TARGET_WORDS
    ):
        piece = words[
            start:
            start + TARGET_WORDS
        ]

        if piece:
            pieces.append(
                " ".join(piece)
            )

    return pieces


def split_text_units(text):
    """
    Prefer paragraph and sentence boundaries.

    If OCR has collapsed a large section into one paragraph,
    sentence boundaries are used.

    If one sentence is still extremely long,
    it is divided into non-overlapping word blocks.

    No overlap is used so Stage-A does not artificially
    duplicate textbook content.
    """

    text = normalize_text(text)

    if not text:
        return []

    paragraphs = [
        paragraph.strip()
        for paragraph in re.split(
            r"\n\s*\n+",
            text
        )
        if paragraph.strip()
    ]

    units = []

    for paragraph in paragraphs:

        words = paragraph.split()

        if len(words) <= MAX_WORDS:

            units.append(
                paragraph
            )

            continue

        sentences = [
            sentence.strip()
            for sentence in re.split(
                r'(?<=[.!?])\s+(?=[A-Z0-9"\'(\[])',
                paragraph
            )
            if sentence.strip()
        ]

        if len(sentences) <= 1:

            units.extend(
                split_long_words(
                    words
                )
            )

            continue

        for sentence in sentences:

            sentence_words = (
                sentence.split()
            )

            if len(
                sentence_words
            ) <= MAX_WORDS:

                units.append(
                    sentence
                )

            else:

                units.extend(
                    split_long_words(
                        sentence_words
                    )
                )

    return units


def build_chunks(book_records):

    units = []

    for record in sorted(
        book_records,
        key=lambda r:
            int(r["page_number"])
    ):

        page = int(
            record["page_number"]
        )

        text = str(
            record.get(
                "text",
                ""
            )
        )

        for unit in split_text_units(
            text
        ):

            units.append(
                {
                    "text":
                        unit,

                    "page":
                        page,

                    "word_count":
                        len(
                            unit.split()
                        ),
                }
            )


    chunks = []

    texts = []
    pages = []
    word_count = 0


    def flush():

        nonlocal texts, pages, word_count

        if not texts:
            return

        chunks.append(
            {
                "text":
                    "\n\n".join(
                        texts
                    ).strip(),

                "page_start":
                    min(pages),

                "page_end":
                    max(pages),

                "word_count":
                    word_count,
            }
        )

        texts = []
        pages = []
        word_count = 0


    for unit in units:

        unit_words = int(
            unit["word_count"]
        )

        if (
            texts
            and word_count >= MIN_WORDS
            and (
                word_count
                + unit_words
                > MAX_WORDS
            )
        ):

            flush()

        texts.append(
            unit["text"]
        )

        pages.append(
            unit["page"]
        )

        word_count += (
            unit_words
        )

        if word_count >= TARGET_WORDS:

            flush()


    flush()


    # Avoid a tiny final chunk when possible.
    if (
        len(chunks) >= 2
        and chunks[-1][
            "word_count"
        ] < MIN_WORDS
    ):

        last = chunks[-1]
        previous = chunks[-2]

        combined_words = (
            previous[
                "word_count"
            ]
            + last[
                "word_count"
            ]
        )

        if (
            combined_words
            <= MAX_WORDS + 100
        ):

            chunks[-2] = {
                "text":
                    (
                        previous["text"]
                        + "\n\n"
                        + last["text"]
                    ).strip(),

                "page_start":
                    previous[
                        "page_start"
                    ],

                "page_end":
                    last[
                        "page_end"
                    ],

                "word_count":
                    combined_words,
            }

            chunks.pop()

    return chunks


def write_jsonl(
    path,
    records
):

    with path.open(
        "w",
        encoding="utf-8"
    ) as handle:

        for record in records:

            handle.write(
                json.dumps(
                    record,
                    ensure_ascii=False
                )
                + "\n"
            )


records = []

with SOURCE.open(
    "r",
    encoding="utf-8-sig"
) as handle:

    for line in handle:

        line = line.strip()

        if line:

            records.append(
                json.loads(line)
            )


by_book = defaultdict(list)

for record in records:

    by_book[
        record["book_id"]
    ].append(
        record
    )


all_chunks = []

summary = {
    "version":
        VERSION,

    "source_corpus":
        str(
            SOURCE.relative_to(
                ROOT
            )
        ),

    "source_corpus_sha256":
        sha256_file(
            SOURCE
        ),

    "source_pages":
        len(records),

    "source_words":
        sum(
            int(
                record.get(
                    "word_count",
                    0
                )
            )
            for record in records
        ),

    "chunk_settings": {
        "minimum_words":
            MIN_WORDS,

        "target_words":
            TARGET_WORDS,

        "maximum_words":
            MAX_WORDS,

        "overlap_words":
            0,

        "eval_source_fraction":
            EVAL_SOURCE_FRACTION,
    },

    "books": {},
}


for book_id, class_level in (
    BOOKS.items()
):

    raw_chunks = build_chunks(
        by_book[
            book_id
        ]
    )

    book_chunks = []

    for index, chunk in enumerate(
        raw_chunks,
        start=1
    ):

        text = chunk["text"]

        book_chunks.append(
            {
                "chunk_version":
                    VERSION,

                "chunk_id":
                    (
                        f"{book_id}-"
                        f"chunk-{index:04d}"
                    ),

                "book_id":
                    book_id,

                "class_level":
                    class_level,

                "page_start":
                    chunk[
                        "page_start"
                    ],

                "page_end":
                    chunk[
                        "page_end"
                    ],

                "word_count":
                    chunk[
                        "word_count"
                    ],

                "text":
                    text,

                "text_sha256":
                    sha256_text(
                        text
                    ),

                # ALL chunks are allowed
                # in Stage-A domain adaptation.
                "stage_a_role":
                    "domain_adaptation",

                "stage_b_role":
                    None,
            }
        )


    # Deterministic reservation.
    #
    # Hash sorting gives us a stable,
    # reproducible selection instead of
    # random manual choosing.

    ranked_indices = sorted(
        range(
            len(book_chunks)
        ),
        key=lambda i:
            sha256_text(
                book_chunks[i][
                    "chunk_id"
                ]
            )
    )

    eval_count = max(
        1,
        round(
            len(book_chunks)
            * EVAL_SOURCE_FRACTION
        )
    )

    eval_indices = set(
        ranked_indices[
            :eval_count
        ]
    )


    for index, record in enumerate(
        book_chunks
    ):

        if index in eval_indices:

            record[
                "stage_b_role"
            ] = (
                "eval_question_source"
            )

        else:

            record[
                "stage_b_role"
            ] = (
                "sft_source"
            )


    all_chunks.extend(
        book_chunks
    )


    summary[
        "books"
    ][book_id] = {

        "class_level":
            class_level,

        "source_pages":
            len(
                by_book[
                    book_id
                ]
            ),

        "chunks":
            len(
                book_chunks
            ),

        "sft_source_chunks":
            sum(
                record[
                    "stage_b_role"
                ]
                == "sft_source"

                for record
                in book_chunks
            ),

        "eval_question_source_chunks":
            sum(
                record[
                    "stage_b_role"
                ]
                == "eval_question_source"

                for record
                in book_chunks
            ),

        "chunk_words":
            sum(
                record[
                    "word_count"
                ]
                for record
                in book_chunks
            ),

        "minimum_chunk_words":
            min(
                record[
                    "word_count"
                ]
                for record
                in book_chunks
            ),

        "maximum_chunk_words":
            max(
                record[
                    "word_count"
                ]
                for record
                in book_chunks
            ),
    }


all_chunks.sort(
    key=lambda record: (
        record[
            "class_level"
        ],
        record[
            "chunk_id"
        ],
    )
)


sft_chunks = [
    record
    for record
    in all_chunks
    if record[
        "stage_b_role"
    ] == "sft_source"
]


eval_chunks = [
    record
    for record
    in all_chunks
    if record[
        "stage_b_role"
    ] == "eval_question_source"
]


all_path = (
    OUT_DIR
    / "nctb_all_semantic_chunks_v2r3.jsonl"
)

sft_path = (
    OUT_DIR
    / "nctb_sft_source_chunks_v2r3.jsonl"
)

eval_path = (
    OUT_DIR
    / "nctb_eval_question_source_chunks_v2r3.jsonl"
)


write_jsonl(
    all_path,
    all_chunks
)

write_jsonl(
    sft_path,
    sft_chunks
)

write_jsonl(
    eval_path,
    eval_chunks
)


summary[
    "combined"
] = {

    "all_chunks":
        len(
            all_chunks
        ),

    "stage_a_chunks":
        len(
            all_chunks
        ),

    "sft_source_chunks":
        len(
            sft_chunks
        ),

    "eval_question_source_chunks":
        len(
            eval_chunks
        ),

    "chunk_words":
        sum(
            record[
                "word_count"
            ]
            for record
            in all_chunks
        ),

    "all_chunks_sha256":
        sha256_file(
            all_path
        ),

    "sft_source_sha256":
        sha256_file(
            sft_path
        ),

    "eval_source_sha256":
        sha256_file(
            eval_path
        ),
}


summary_path = (
    REPORT_DIR
    / "semantic_chunks_v2r3_summary.json"
)


summary_path.write_text(
    json.dumps(
        summary,
        ensure_ascii=False,
        indent=2
    )
    + "\n",
    encoding="utf-8"
)


lock_path = (
    REPORT_DIR
    / "semantic_chunks_v2r3_lock.txt"
)


lock_path.write_text(
    "\n".join(
        [
            "NCTB Study Companion",
            "Semantic Chunk Corpus v2r3",
            "",
            (
                "Source corpus SHA256: "
                f"{summary['source_corpus_sha256']}"
            ),
            (
                "All chunks: "
                f"{len(all_chunks)}"
            ),
            (
                "SFT-source chunks: "
                f"{len(sft_chunks)}"
            ),
            (
                "Evaluation-question "
                "source chunks: "
                f"{len(eval_chunks)}"
            ),
            (
                "All chunks SHA256: "
                f"{summary['combined']['all_chunks_sha256']}"
            ),
            (
                "SFT source SHA256: "
                f"{summary['combined']['sft_source_sha256']}"
            ),
            (
                "Evaluation source SHA256: "
                f"{summary['combined']['eval_source_sha256']}"
            ),
            "",
            (
                "Stage A domain adaptation "
                "uses ALL chunks."
            ),
            (
                "Stage B supervised example "
                "generation uses ONLY "
                "nctb_sft_source_chunks_v2r3.jsonl."
            ),
            (
                "Closed-book evaluation questions "
                "use ONLY "
                "nctb_eval_question_source_chunks_v2r3.jsonl."
            ),
            (
                "Evaluation questions must never "
                "enter Stage B training."
            ),
        ]
    )
    + "\n",
    encoding="utf-8"
)


print()
print("=" * 78)
print("NCTB SEMANTIC CHUNKS V2R3 CREATED")
print("=" * 78)

print(
    "Source pages:",
    len(records)
)

print(
    "Source words:",
    summary[
        "source_words"
    ]
)

print(
    "All chunks:",
    len(all_chunks)
)

print(
    "SFT-source chunks:",
    len(sft_chunks)
)

print(
    "Eval-question-source chunks:",
    len(eval_chunks)
)

print()


for book_id in (
    "class6-english",
    "class7-english",
    "class8-english",
):

    data = summary[
        "books"
    ][book_id]

    print(
        book_id
    )

    print(
        "  Chunks:",
        data["chunks"]
    )

    print(
        "  SFT source:",
        data[
            "sft_source_chunks"
        ]
    )

    print(
        "  Eval source:",
        data[
            "eval_question_source_chunks"
        ]
    )

    print(
        "  Chunk words:",
        data[
            "chunk_words"
        ]
    )

    print(
        "  Word range:",
        (
            f"{data['minimum_chunk_words']}"
            "-"
            f"{data['maximum_chunk_words']}"
        )
    )

    print()


print(
    "All chunks SHA256:",
    summary[
        "combined"
    ][
        "all_chunks_sha256"
    ]
)

print(
    "SFT source SHA256:",
    summary[
        "combined"
    ][
        "sft_source_sha256"
    ]
)

print(
    "Eval source SHA256:",
    summary[
        "combined"
    ][
        "eval_source_sha256"
    ]
)

print()

print(
    "All chunks:",
    all_path.relative_to(
        ROOT
    )
)

print(
    "SFT source:",
    sft_path.relative_to(
        ROOT
    )
)

print(
    "Eval source:",
    eval_path.relative_to(
        ROOT
    )
)

print(
    "Summary:",
    summary_path.relative_to(
        ROOT
    )
)

print(
    "Lock:",
    lock_path.relative_to(
        ROOT
    )
)

print()

print(
    "PASS: v2r2 training-ready "
    "corpus was not modified."
)

