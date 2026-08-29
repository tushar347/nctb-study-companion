# Pilot SFT Quality Audit v2

## Summary

- Candidate examples: 76
- Automatic pass: 44
- Manual review required: 31
- Automatic reject: 1
- Automatic pass rate: 57.89%
- Non-reject rate: 98.68%

## Detected Issues

- source flag: MULTIPLE_OCR_VERSIONS: 29
- source page requires manual review: 29
- question does not end with a question mark: 2
- question is based on a lesson list: 1
- possible grammar error: did + held: 1
- possible grammar error: did + was: 1

## Research Decision

- Automatic PASS does not replace human review.
- REVIEW records may be accepted after correction.
- REJECT records must not enter the fine-tuning dataset.
- The locked test split was not used during candidate generation.
