# Normalized OCR Passage Manifest

## Summary

- OCR source files: 284
- Candidate page records found: 531
- Canonical book/page records: 240
- Rejected candidates: 97
- Parse errors: 0
- RAG-ready pages: 240
- Fine-tuning source candidates: 238
- Pages linked to a lesson: 88
- Pages with alternative source records: 97
- Pages with differing OCR text versions: 97
- Exact duplicate text groups: 0

## Canonical Records by Book

| Book | Pages |
|---|---:|
| `class6-english` | 113 |
| `class7-english` | 122 |
| `class8-english` | 5 |

## Records by Class

| Class | Pages |
|---|---:|
| 6 | 113 |
| 7 | 122 |
| 8 | 5 |

## Selected Text Sources

| Source field | Pages |
|---|---:|
| `aiReadyText` | 240 |

## Passage Length

- Average words per page: 176.75
- Median words per page: 172.0
- Minimum words: 7
- Maximum words: 735
- Average characters per page: 987.75

## Quality Flags

- TOO_SHORT: 2
- TOO_FEW_WORDS: 2

## Research Use

- `ocr_passage_manifest.jsonl` contains the local canonical text.
- `ocr_passage_manifest_metadata.csv` contains metadata without full passage text.
- The metadata CSV is safer for version control and reporting.
- Full textbook text should not be published publicly until copyright and dataset-release permission are confirmed.
- No student records or operational request logs were included.

## Next Phase

- Review quality-flagged pages.
- Assign lesson-aware train, validation, and test groups.
- Lock a benchmark set before generating synthetic questions.
