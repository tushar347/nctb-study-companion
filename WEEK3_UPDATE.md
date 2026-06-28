# Week 3 Update — OCR-backed Textbook Reader

## Project Name

NCTB Study Companion

## Week 3 Main Goal

The main goal of Week 3 was to improve the book reading system. At first, the plan was to show the textbook PDF inside the app. After testing, the PDF preview was not useful enough because students could not properly select textbook lines from it and connect them with the helper system.

So, the reading system was changed to an OCR-backed textbook reader. The textbook text was extracted from the book and stored in structured format. Now students can open the book, select a lesson, read the extracted textbook text, click a line, and get help.

## What Was Changed

The earlier PDF preview idea was removed from the main student flow. The app now uses extracted textbook text instead of showing only the PDF.

The new flow is:

```text
Home
→ Book Library
→ Class 6 English for Today
→ OCR Book Reader
→ Select Lesson
→ Select Line
→ Explain / Bangla / Grammar / Quiz / Report
```

## Completed Work

### 1. OCR-backed book data added

A new data file was added:

```text
data/ocrBook.ts
```

This file stores extracted textbook content in lesson format.

The current OCR-backed reader includes:

```text
Lesson 1 — Going to a New School
Lesson 2 — Congratulations! Well Done!
Lesson 3 — At a Railway Station
Lesson 4 — Where are You From?
Lesson 5 — Thanks for Your Work
```

### 2. OCR book API routes added

Two new API routes were added:

```text
/api/ocr-book
/api/ocr-book/lessons/[lessonNo]
```

The `/api/ocr-book` route returns the book information and lesson list.

The `/api/ocr-book/lessons/[lessonNo]` route returns the selected lesson text and splits it into selectable lines.

### 3. Frontend connected to OCR reader

The frontend reader was updated to use the new OCR API instead of only using the old fixed Lesson 1 data.

The Reader page now supports:

```text
Lesson 1
Lesson 2
Lesson 3
Lesson 4
Lesson 5
```

When a lesson is selected, the app loads that lesson’s OCR-backed textbook lines.

### 4. PDF tab removed

The PDF tab was removed from the student interface because the main reading experience is now based on extracted textbook text. The PDF is treated as the original source, but the app uses OCR-backed text for interaction.

### 5. Line helper connected with OCR text

When a student clicks any extracted textbook line, the app shows:

```text
Simple Explanation
Bangla Help
Grammar Help
Quiz option
```

This keeps the original purpose of the project: helping students understand textbook lines easily.

## Testing Checklist

Week 3 is complete if the following are working:

```text
/api/ocr-book shows the OCR book and lesson list
/api/ocr-book/lessons/1 works
/api/ocr-book/lessons/5 works
Reader page shows Lesson 1–5 buttons
Clicking a lesson loads that lesson text
Clicking a line shows helper output
PDF tab is removed from the navigation
Quiz and Report pages still work
```

## Limitation

The current version does not perform live OCR inside the browser. The book text was extracted earlier using OCR-assisted processing and then added to the project as structured text.

Live PDF upload, automatic OCR extraction, OCR correction, and full-book search can be added in a future version.

## Summary

In Week 3, the project was improved from a simple PDF preview idea into an OCR-backed textbook reader. Students can now open Class 6 English for Today, choose Lessons 1–5, read extracted textbook content, select a line, and use the learning helper features.
