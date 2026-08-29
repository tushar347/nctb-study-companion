# NCTB Study Companion Dataset Audit

Generated: 2026-08-02T18:34:38.922239+00:00

## Hardware

- Platform: Windows-11-10.0.26200-SP0
- Processor: Intel64 Family 6 Model 141 Stepping 1, GenuineIntel
- Python: 3.12.4
- GPU: NVIDIA GeForce GTX 1650 with Max-Q Design
- GPU memory: 4096 MB total, 3762 MB free
- NVIDIA driver: 555.99

## File Inventory

- Data-like files scanned: 288
- Successfully parsed: 288
- Partially parsed: 0
- Parse errors: 0

## Data Categories

| Category | Files | Estimated records |
|---|---:|---:|
| OTHER | 4 | 51739 |
| TEXTBOOK_OCR | 284 | 866 |

## Observed Metadata

- **bookId:** class6-english, class7-english, class8-english
- **class:** Six
- **lessonNo:** 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 2, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 3, 30, 31, 32, 33, 4, 5, 6, ... (33 values)
- **pageNumber:** 1, 10, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 11, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 12, 120, 121, 122, 13, 14, 15, ... (122 values)

## Prisma Models

- Student
- StudentMemory
- DailyStudyRecord
- GameAttempt
- ResearchEvent
- QuizAttempt
- ChatMessage
- StudentWallet
- RewardTransaction
- AiUsageLog
- Book
- BookPage
- OCRLine
- SpellingAttempt
- SpeakingAttempt
- StudentGoalSetting
- DailyGoalProgress
- RewardItem
- StudentReward

## Duplicate Files

- Exact duplicate groups: 0

## Sensitive-field Review

The following field names were detected. Their values must not be placed in a public training dataset without anonymization and approval:

- studentId: found in 1 file(s)

## Preliminary Dataset Readiness

- TEXTBOOK_OCR files may provide passages and source grounding.
- ASSESSMENT files may provide question-generation and answer examples.
- VOICE_PRACTICE files may provide transcript-based feedback examples.
- AI_TEACHER data may contain useful instruction-response pairs, but outputs require quality review.
- OPERATIONAL_STUDENT_DATA should not be copied directly into the public training dataset.
- Raw OCR text is not automatically a supervised fine-tuning dataset.
- Train, validation, and test splits should be separated by lesson, unit, or page group.

## Generated Files

- Inventory CSV: research\data\project_data_inventory.csv
- Full audit JSON: research\reports\dataset_audit.json
- This report: research/reports/dataset_audit.md
