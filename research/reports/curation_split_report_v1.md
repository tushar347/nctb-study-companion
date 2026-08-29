# OCR Curation and Dataset Split v1

Generated: 2026-08-02T19:01:38.000937+00:00

## Curation Results

- Source canonical pages: 240
- RAG-eligible pages: 225
- SFT-eligible pages (Classes 6 and 7): 216
- Manual-review queue rows: 125

## Locked Splits

| Split | Pages |
|---|---:|
| `train` | 166 |
| `validation` | 27 |
| `test` | 23 |
| `external_class8` | 1 |

## Pages by Book and Split

| Book | Train | Validation | Test | External Class 8 |
|---|---:|---:|---:|---:|
| `class6-english` | 74 | 17 | 17 | 0 |
| `class7-english` | 92 | 10 | 6 | 0 |
| `class8-english` | 0 | 0 | 0 | 1 |

## Curation Flags

- MULTIPLE_OCR_VERSIONS: 97
- TOO_SHORT_FOR_SFT: 14
- FRONT_MATTER: 13
- OCR_REVIEW_NEEDED: 8
- CLASS8_EXTERNAL_ONLY: 5
- ENCODING_REPAIRED: 2
- TOO_LONG_FOR_SFT: 1

## Exclusion Reasons

- fewer than 40 words: 14
- front matter: 13
- Class 8 external test only: 5
- more than 600 words: 1

## Leakage Prevention

- Pages with a lesson number were grouped by book and lesson.
- Pages without lesson metadata were grouped into contiguous five-page blocks.
- Every group was assigned wholly to train, validation, or test.
- Class 8 was excluded from the main SFT split because only five canonical pages are available.
- Class 8 is retained as a small exploratory external test set.

## Locked Test Set

- Test pages: 23
- SHA256: `d8a50ad562e733776ac47d7f84378d2fd96432b801ce1003b1a5c9d605b2a62f`
- The test pages must not be sent to a model for training-data generation.

## Files

- Curated local manifest: `research/data/processed/ocr_curated_manifest_v1.jsonl`
- Manual review queue: `research/data/processed/ocr_manual_review_queue_v1.csv`
- Split metadata: `research/data/splits/split_metadata_v1.csv`
- Test lock: `research/reports/test_split_v1_lock.txt`
