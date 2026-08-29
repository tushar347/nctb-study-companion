# OCR Dataset Schema Profile

- OCR files profiled: 284
- Parse errors: 0
- Candidate text samples: 200

## Root JSON Shapes

| Shape | Files |
|---|---:|
| `object:aiReadyLines,aiReadyText,bookId,cleanText,height,image,lines,pageNumber,rawText,source,width` | 242 |
| `object:aiReadyLines,aiReadyText,cleanText,lessonNo,lines,pages,pdfPageEnd,pdfPageStart,rawText,textbookPageEnd,textbookPageStart,title` | 30 |
| `object:aiReadyLines,aiReadyText,cleanText,lessonNo,lessonTitle,lines,pdfPageEnd,pdfPageStart,rawText,textbookPageEnd,textbookPageStart,title` | 4 |
| `object:bookId,endPage,pages,sourcePdf,startPage,title,totalPdfPages` | 3 |
| `object:lessons,metadata` | 2 |
| `array:24` | 1 |
| `array:98` | 1 |
| `object:metadata,pages` | 1 |

## Most Common JSON Keys

| Key | Occurrences |
|---|---:|
| `text` | 22206 |
| `id` | 22108 |
| `source` | 11319 |
| `width` | 11199 |
| `height` | 11199 |
| `x` | 10957 |
| `y` | 10957 |
| `linenumber` | 10935 |
| `confidence` | 10933 |
| `bbox` | 10859 |
| `cleantext` | 6078 |
| `aiready` | 5796 |
| `aireadylines` | 630 |
| `rawtext` | 600 |
| `pagenumber` | 484 |
| `image` | 484 |
| `aireadytext` | 336 |
| `lines` | 306 |
| `pdfpage` | 294 |
| `textbookpage` | 294 |
| `rawlines` | 294 |
| `cleanlines` | 294 |
| `bookid` | 245 |
| `json` | 242 |
| `linecount` | 242 |
| `aireadylinecount` | 242 |
| `title` | 97 |
| `pdfpagestart` | 97 |
| `pdfpageend` | 97 |
| `textbookpagestart` | 97 |
| `textbookpageend` | 97 |
| `lessonno` | 94 |
| `paragraphno` | 76 |
| `pages` | 64 |
| `sourcepdf` | 6 |
| `totalpdfpages` | 6 |
| `lessontitle` | 4 |
| `startpage` | 3 |
| `endpage` | 3 |
| `metadata` | 3 |

## Candidate Text Fields

| JSON path | Count | Average length | Minimum | Maximum |
|---|---:|---:|---:|---:|
| `$.lines[].text` | 8158 | 42.78 | 3 | 184 |
| `$.lines[].id` | 8158 | 17.38 | 17 | 22 |
| `$.aiReadyLines[].text` | 7298 | 45.43 | 8 | 184 |
| `$.aiReadyLines[].id` | 7298 | 16.83 | 15 | 21 |
| `$.lines[].cleanText` | 5772 | 42.66 | 2 | 92 |
| `$.lines[].source` | 5772 | 9.0 | 8 | 9 |
| `$.aiReadyLines[].source` | 5063 | 9.0 | 8 | 9 |
| `$.lessons[].aiReadyLines[].text` | 4318 | 44.03 | 8 | 90 |
| `$.lessons[].aiReadyLines[].id` | 4318 | 16.29 | 15 | 20 |
| `$.lessons[].lines[].text` | 2310 | 41.63 | 3 | 90 |
| `$.lessons[].lines[].id` | 2310 | 18.29 | 17 | 22 |
| `$.rawText` | 274 | 1314.91 | 54 | 14500 |
| `$.cleanText` | 274 | 1293.9 | 54 | 13950 |
| `$.aiReadyText` | 274 | 1235.56 | 54 | 13755 |
| `$.bookId` | 245 | 14 | 14 | 14 |
| `$.pages[].image` | 242 | 50 | 50 | 50 |
| `$.image` | 242 | 50 | 50 | 50 |
| `$.pages[].json` | 242 | 45 | 45 | 45 |
| `$.pages[].source` | 242 | 9.0 | 8 | 9 |
| `$.source` | 242 | 9.0 | 8 | 9 |
| `$.pages[].rawText` | 194 | 1048.97 | 202 | 2523 |
| `$[].text` | 122 | 6.98 | 1 | 78 |
| `$.lessons[].pages[].rawText` | 97 | 1048.97 | 202 | 2523 |
| `$.lessons[].aiReadyText` | 60 | 3239.83 | 668 | 13755 |
| `$.lessons[].title` | 60 | 19.57 | 5 | 41 |
| `$.title` | 37 | 20.57 | 5 | 41 |
| `$.lessons[].rawText` | 30 | 3393.9 | 677 | 14500 |
| `$.lessons[].cleanText` | 30 | 3281.6 | 668 | 13950 |
| `$[].id` | 24 | 6.62 | 6 | 7 |
| `$.lessonTitle` | 4 | 21.75 | 19 | 27 |
| `$.metadata.note` | 3 | 86 | 86 | 86 |
| `$.metadata.sourcePdf` | 3 | 40 | 40 | 40 |
| `$.sourcePdf` | 3 | 35 | 35 | 35 |
| `$.metadata.bookTitle` | 3 | 17 | 17 | 17 |
| `$.metadata.ocrEnd` | 3 | 11 | 11 | 11 |
| `$.metadata.ocrStart` | 3 | 8 | 8 | 8 |
| `$.metadata.class` | 3 | 3 | 3 | 3 |

## Array Structures

| JSON path | Occurrences | Average items | Minimum | Maximum |
|---|---:|---:|---:|---:|
| `$.lines` | 276 | 29.56 | 0 | 278 |
| `$.aiReadyLines` | 276 | 26.44 | 0 | 257 |
| `$.pages[].rawLines` | 196 | 26.82 | 0 | 47 |
| `$.pages[].cleanLines` | 196 | 23.76 | 0 | 44 |
| `$.pages[].aiReadyLines` | 196 | 22.22 | 0 | 38 |
| `$.lessons[].pages[].rawLines` | 98 | 26.82 | 0 | 47 |
| `$.lessons[].pages[].cleanLines` | 98 | 23.57 | 0 | 44 |
| `$.lessons[].pages[].aiReadyLines` | 98 | 22.03 | 0 | 38 |
| `$.lessons[].aiReadyLines` | 60 | 71.97 | 20 | 257 |
| `$.pages` | 34 | 12.88 | 1 | 122 |
| `$.lessons[].pages` | 30 | 3.27 | 1 | 10 |
| `$.lessons[].lines` | 30 | 77 | 20 | 278 |
| `$` | 2 | 61 | 24 | 98 |
| `$.lessons` | 2 | 30 | 30 | 30 |

## Metadata Values

- **bookid:** class6-english, class7-english, class8-english
- **class:** Six
- **lessonno:** 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 2, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 3, 30, 31, 32, 33, 4, 5, 6, 7, 8, 9
- **pagenumber:** 1, 10, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 11, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 12, 120, 121, 122, 13, 14, 15, 16, 17, 18, 19, 2, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 3, 30, 31, 32, 33, ... (122 total)

## Research Decision

- This profile describes the source structure only.
- No training examples have been generated yet.
- Student and operational data are excluded.
- The next script will normalize OCR content into one passage record per book/page/lesson.
