import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Difficulty =
  | "easy"
  | "medium"
  | "hard";

type QuizRequest = {
  mode?: "model";
  bookId?: string;
  classLevel?: number;
  pageNumber?: number;
  lessonNo?: number;
  lessonTitle?: string;
  selectedText?: string;
  difficulty?: Difficulty;
};

type UnknownRecord =
  Record<string, unknown>;

type McqQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  marks: number;
};

type PassageQuestion = {
  id: string;
  question: string;
  expectedAnswer: string;
  keywords: string[];
  explanation: string;
  marks: number;
};

type FillQuestion = {
  id: string;
  sentence: string;
  acceptedAnswers: string[];
  explanation: string;
  marks: number;
};

type ModelQuizPaper = {
  schemaVersion: 1;
  quizId: string;
  mode: "model";
  title: string;
  bookId: string;
  classLevel: number;
  pageNumber: number;
  lessonNo: number;
  lessonTitle: string;
  difficulty: Difficulty;
  passage: string;
  instructions: string[];
  timeMinutes: 30;
  totalMarks: 20;
  sections: {
    mcq: McqQuestion[];
    passageQuestions: PassageQuestion[];
    fillWithoutClues: FillQuestion[];
    fillWithClues: {
      clueBox: string[];
      questions: FillQuestion[];
    };
  };
};

const ALLOWED_BOOKS = new Set([
  "class6-english",
  "class7-english",
  "class8-english",
]);

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "before",
  "being",
  "could",
  "every",
  "first",
  "from",
  "have",
  "into",
  "other",
  "should",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "under",
  "very",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "would",
]);

function cleanSingleLine(
  value: unknown,
): string {
  return String(value ?? "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\*\*/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function cleanContext(
  value: unknown,
): string {
  return String(value ?? "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map((line) =>
      cleanSingleLine(line),
    )
    .filter(
      (line) =>
        line.length >= 8 &&
        /[A-Za-z]{3}/.test(line),
    )
    .join("\n")
    .slice(0, 9000);
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
): number {
  const numberValue = Number(value);

  if (
    Number.isInteger(numberValue) &&
    numberValue > 0
  ) {
    return numberValue;
  }

  return fallback;
}

function inferClassLevel(
  bookId: string,
  suppliedValue: unknown,
): number {
  const suppliedNumber =
    Number(suppliedValue);

  if (
    Number.isInteger(suppliedNumber) &&
    suppliedNumber > 0
  ) {
    return suppliedNumber;
  }

  const match = bookId.match(
    /class(\d+)/i,
  );

  return match ? Number(match[1]) : 6;
}

async function loadPageContext(
  bookId: string,
  pageNumber: number,
): Promise<string> {
  const fileName =
    `page-${String(pageNumber).padStart(
      3,
      "0",
    )}.json`;

  const filePath = path.join(
    process.cwd(),
    "public",
    "ocr",
    "books",
    bookId,
    "pages",
    fileName,
  );

  try {
    const raw = await readFile(
      filePath,
      "utf-8",
    );

    const page = JSON.parse(
      raw.replace(/^\uFEFF/, ""),
    ) as UnknownRecord;

    if (
      typeof page.aiReadyText ===
      "string"
    ) {
      return cleanContext(
        page.aiReadyText,
      );
    }

    if (
      Array.isArray(
        page.aiReadyLines,
      )
    ) {
      return cleanContext(
        page.aiReadyLines
          .map((line) => {
            if (
              line &&
              typeof line === "object"
            ) {
              return (
                line as UnknownRecord
              ).text;
            }

            return "";
          })
          .join("\n"),
      );
    }

    if (Array.isArray(page.lines)) {
      return cleanContext(
        page.lines
          .map((line) => {
            if (
              !line ||
              typeof line !== "object"
            ) {
              return "";
            }

            const record =
              line as UnknownRecord;

            if (
              record.aiReady === false
            ) {
              return "";
            }

            return (
              record.cleanText ??
              record.text ??
              ""
            );
          })
          .join("\n"),
      );
    }

    return "";
  } catch {
    return "";
  }
}

function splitSentences(
  context: string,
): string[] {
  return context
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) =>
      cleanSingleLine(sentence),
    )
    .filter(
      (sentence) =>
        sentence.length >= 24 &&
        /[A-Za-z]{3}/.test(sentence),
    );
}

function meaningfulWords(
  value: string,
): string[] {
  return Array.from(
    new Set(
      (
        value.match(
          /[A-Za-z]{5,}/g,
        ) ?? []
      )
        .map((word) =>
          word.toLowerCase(),
        )
        .filter(
          (word) =>
            !STOP_WORDS.has(word),
        ),
    ),
  );
}

function extractJsonText(
  value: string,
): string {
  const cleaned = value
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const objectStart =
    cleaned.indexOf("{");

  const objectEnd =
    cleaned.lastIndexOf("}");

  if (
    objectStart >= 0 &&
    objectEnd > objectStart
  ) {
    return cleaned.slice(
      objectStart,
      objectEnd + 1,
    );
  }

  return cleaned;
}

function asRecord(
  value: unknown,
): UnknownRecord {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as UnknownRecord;
  }

  return {};
}

function asStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          cleanSingleLine(item),
        )
        .filter(Boolean),
    ),
  );
}

function normalizeMcq(
  value: unknown,
): McqQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const questions: McqQuestion[] =
    [];

  for (const item of value) {
    const record = asRecord(item);

    const question =
      cleanSingleLine(
        record.question,
      );

    const options =
      asStringArray(
        record.options,
      );

    const correctAnswerIndex =
      Number(
        record.correctAnswerIndex,
      );

    if (
      !question ||
      options.length !== 4 ||
      !Number.isInteger(
        correctAnswerIndex,
      ) ||
      correctAnswerIndex < 0 ||
      correctAnswerIndex > 3
    ) {
      continue;
    }

    questions.push({
      id: `mcq-${questions.length + 1}`,
      question,
      options,
      correctAnswerIndex,
      explanation:
        cleanSingleLine(
          record.explanation,
        ) ||
        "The answer is supported by the passage.",
      marks: 1,
    });

    if (questions.length === 5) {
      break;
    }
  }

  return questions;
}

function normalizePassageQuestions(
  value: unknown,
): PassageQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const questions: PassageQuestion[] =
    [];

  for (const item of value) {
    const record = asRecord(item);

    const question =
      cleanSingleLine(
        record.question,
      );

    const expectedAnswer =
      cleanSingleLine(
        record.expectedAnswer ??
          record.answer,
      );

    const keywords =
      asStringArray(
        record.keywords,
      ).slice(0, 5);

    if (
      !question ||
      !expectedAnswer
    ) {
      continue;
    }

    questions.push({
      id:
        `passage-${questions.length + 1}`,
      question,
      expectedAnswer,
      keywords:
        keywords.length > 0
          ? keywords
          : meaningfulWords(
              expectedAnswer,
            ).slice(0, 3),
      explanation:
        cleanSingleLine(
          record.explanation,
        ) ||
        "This answer is supported by the passage.",
      marks: 1,
    });

    if (questions.length === 5) {
      break;
    }
  }

  return questions;
}

function normalizeFillQuestions(
  value: unknown,
  prefix: string,
): FillQuestion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const questions: FillQuestion[] =
    [];

  for (const item of value) {
    const record = asRecord(item);

    const sentence =
      cleanSingleLine(
        record.sentence ??
          record.question,
      );

    const acceptedAnswers =
      asStringArray(
        record.acceptedAnswers ??
          record.answers,
      );

    const singleAnswer =
      cleanSingleLine(
        record.answer,
      );

    if (
      acceptedAnswers.length === 0 &&
      singleAnswer
    ) {
      acceptedAnswers.push(
        singleAnswer,
      );
    }

    if (
      !sentence ||
      !sentence.includes("_____") ||
      acceptedAnswers.length === 0
    ) {
      continue;
    }

    questions.push({
      id:
        `${prefix}-${questions.length + 1}`,
      sentence,
      acceptedAnswers,
      explanation:
        cleanSingleLine(
          record.explanation,
        ) ||
        "The missing word completes the sentence correctly.",
      marks: 1,
    });

    if (questions.length === 5) {
      break;
    }
  }

  return questions;
}

function makeFallbackPaper({
  context,
  bookId,
  classLevel,
  pageNumber,
  lessonNo,
  lessonTitle,
  difficulty,
}: {
  context: string;
  bookId: string;
  classLevel: number;
  pageNumber: number;
  lessonNo: number;
  lessonTitle: string;
  difficulty: Difficulty;
}): ModelQuizPaper {
  const sentences =
    splitSentences(context);

  const safeSentences =
    sentences.length > 0
      ? sentences
      : [
          "English learners read the passage carefully and use its information to answer questions.",
        ];

  const wordPool =
    meaningfulWords(context);

  const safeWordPool =
    wordPool.length >= 8
      ? wordPool
      : [
          "english",
          "student",
          "lesson",
          "learning",
          "passage",
          "answer",
          "reading",
          "school",
        ];

  const mcq: McqQuestion[] =
    [];

  const fillWithoutClues:
    FillQuestion[] = [];

  const fillWithClues:
    FillQuestion[] = [];

  const passageQuestions:
    PassageQuestion[] = [];

  for (let index = 0; index < 5; index += 1) {
    const sentence =
      safeSentences[
        index %
          safeSentences.length
      ];

    const sentenceWords =
      meaningfulWords(sentence);

    const answer =
      sentenceWords[0] ??
      safeWordPool[
        index %
          safeWordPool.length
      ];

    const distractors =
      safeWordPool
        .filter(
          (word) =>
            word !== answer,
        )
        .slice(index, index + 3);

    while (
      distractors.length < 3
    ) {
      distractors.push(
        `option${distractors.length + 1}`,
      );
    }

    const capitalizedAnswer =
      answer.charAt(0).toUpperCase() +
      answer.slice(1);

    const sentenceWithGap =
      sentence.replace(
        new RegExp(
          `\\b${answer}\\b`,
          "i",
        ),
        "_____",
      );

    const options = [
      distractors[0],
      capitalizedAnswer,
      distractors[1],
      distractors[2],
    ].map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1),
    );

    mcq.push({
      id: `mcq-${index + 1}`,
      question:
        `Choose the word that correctly completes the sentence: ${sentenceWithGap}`,
      options,
      correctAnswerIndex: 1,
      explanation:
        `"${capitalizedAnswer}" is used in the source passage.`,
      marks: 1,
    });

    passageQuestions.push({
      id:
        `passage-${index + 1}`,
      question:
        index === 0
          ? "What is the passage mainly about?"
          : `What information does the passage give about "${answer}"?`,
      expectedAnswer: sentence,
      keywords:
        meaningfulWords(
          sentence,
        ).slice(0, 3),
      explanation:
        "The answer can be found in the supplied passage.",
      marks: 1,
    });

    fillWithoutClues.push({
      id:
        `without-${index + 1}`,
      sentence: sentenceWithGap,
      acceptedAnswers: [
        capitalizedAnswer,
        answer,
      ],
      explanation:
        `"${capitalizedAnswer}" completes the sentence.`,
      marks: 1,
    });

    const clueAnswer =
      safeWordPool[
        (index + 3) %
          safeWordPool.length
      ];

    const clueSentence =
      safeSentences[
        (index + 1) %
          safeSentences.length
      ];

    const clueSentenceWithGap =
      clueSentence.replace(
        new RegExp(
          `\\b${clueAnswer}\\b`,
          "i",
        ),
        "_____",
      );

    fillWithClues.push({
      id: `with-${index + 1}`,
      sentence:
        clueSentenceWithGap ===
        clueSentence
          ? `${clueSentence} The appropriate word is _____.`
          : clueSentenceWithGap,
      acceptedAnswers: [
        clueAnswer,
      ],
      explanation:
        `"${clueAnswer}" is the appropriate clue.`,
      marks: 1,
    });
  }

  const clueBox = Array.from(
    new Set(
      fillWithClues.map(
        (question) =>
          question.acceptedAnswers[0],
      ),
    ),
  );

  while (clueBox.length < 5) {
    const candidate =
      safeWordPool[
        clueBox.length %
          safeWordPool.length
      ];

    if (
      !clueBox.includes(candidate)
    ) {
      clueBox.push(candidate);
    } else {
      clueBox.push(
        `word${clueBox.length + 1}`,
      );
    }
  }

  return {
    schemaVersion: 1,
    quizId:
      crypto.randomUUID(),
    mode: "model",
    title:
      "Traditional English Model Test",
    bookId,
    classLevel,
    pageNumber,
    lessonNo,
    lessonTitle,
    difficulty,
    passage:
      context.slice(0, 3500),
    instructions: [
      "Answer all questions.",
      "Read the passage carefully before answering.",
      "Write passage answers in complete sentences.",
      "Use words from the clue box only in Section D.",
    ],
    timeMinutes: 30,
    totalMarks: 20,
    sections: {
      mcq,
      passageQuestions,
      fillWithoutClues,
      fillWithClues: {
        clueBox,
        questions:
          fillWithClues,
      },
    },
  };
}

function mergeToFive<T>(
  primary: T[],
  fallback: T[],
): T[] {
  return [
    ...primary,
    ...fallback.slice(
      primary.length,
    ),
  ].slice(0, 5);
}

function normalizeGeneratedPaper(
  value: unknown,
  fallback: ModelQuizPaper,
): ModelQuizPaper {
  const root = asRecord(value);

  const sections =
    asRecord(root.sections);

  const generatedMcq =
    normalizeMcq(
      sections.mcq,
    );

  const generatedPassage =
    normalizePassageQuestions(
      sections.passageQuestions,
    );

  const generatedWithout =
    normalizeFillQuestions(
      sections.fillWithoutClues,
      "without",
    );

  const withCluesRecord =
    asRecord(
      sections.fillWithClues,
    );

  const generatedWith =
    normalizeFillQuestions(
      withCluesRecord.questions,
      "with",
    );

  const generatedClueBox =
    asStringArray(
      withCluesRecord.clueBox,
    );

  const clueBox = Array.from(
    new Set([
      ...generatedClueBox,
      ...generatedWith.map(
        (question) =>
          question.acceptedAnswers[0],
      ),
      ...fallback.sections
        .fillWithClues.clueBox,
    ]),
  ).slice(0, 8);

  return {
    ...fallback,
    title:
      cleanSingleLine(
        root.title,
      ) || fallback.title,
    passage:
      cleanContext(
        root.passage,
      ) || fallback.passage,
    instructions:
      asStringArray(
        root.instructions,
      ).length > 0
        ? asStringArray(
            root.instructions,
          ).slice(0, 6)
        : fallback.instructions,
    sections: {
      mcq: mergeToFive(
        generatedMcq,
        fallback.sections.mcq,
      ),
      passageQuestions:
        mergeToFive(
          generatedPassage,
          fallback.sections
            .passageQuestions,
        ),
      fillWithoutClues:
        mergeToFive(
          generatedWithout,
          fallback.sections
            .fillWithoutClues,
        ),
      fillWithClues: {
        clueBox,
        questions: mergeToFive(
          generatedWith,
          fallback.sections
            .fillWithClues.questions,
        ),
      },
    },
  };
}

function difficultyInstructions(
  difficulty: Difficulty,
): string {
  if (difficulty === "easy") {
    return `
- Use direct facts and simple vocabulary.
- Keep passage answers short and explicit.
- Avoid difficult inference.
`;
  }

  if (difficulty === "hard") {
    return `
- Include inference, vocabulary in context and close reading.
- Use plausible MCQ distractors.
- Passage questions may require two linked ideas.
`;
  }

  return `
- Mix direct comprehension, vocabulary, grammar and light inference.
- Keep the language suitable for the selected class.
- Use believable but fair MCQ distractors.
`;
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as QuizRequest;

    const bookId =
      String(
        body.bookId ??
          "class6-english",
      ).trim();

    if (
      !ALLOWED_BOOKS.has(bookId)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected book is not supported.",
        },
        {
          status: 400,
        },
      );
    }

    const pageNumber =
      normalizePositiveInteger(
        body.pageNumber,
        1,
      );

    const lessonNo =
      normalizePositiveInteger(
        body.lessonNo,
        pageNumber,
      );

    const classLevel =
      inferClassLevel(
        bookId,
        body.classLevel,
      );

    const lessonTitle =
      cleanSingleLine(
        body.lessonTitle,
      ) ||
      `English For Today — Page ${pageNumber}`;

    const difficulty: Difficulty =
      body.difficulty === "easy" ||
      body.difficulty === "hard"
        ? body.difficulty
        : "medium";

    const selectedText =
      cleanContext(
        body.selectedText,
      );

    const pageContext =
      await loadPageContext(
        bookId,
        pageNumber,
      );

    const combinedContext =
      cleanContext(
        [
          selectedText,
          pageContext,
        ]
          .filter(Boolean)
          .join("\n"),
      );

    if (
      combinedContext.length < 40
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "There is not enough cleaned textbook text on this page. Return to the reader and choose a page containing a passage.",
        },
        {
          status: 400,
        },
      );
    }

    const fallback =
      makeFallbackPaper({
        context:
          combinedContext,
        bookId,
        classLevel,
        pageNumber,
        lessonNo,
        lessonTitle,
        difficulty,
      });

    const apiKey =
      process.env.GEMINI_API_KEY;

    const model =
      process.env.GEMINI_MODEL ??
      "gemini-2.5-flash";

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        paper: fallback,
        source:
          "local-fallback",
        warning:
          "GEMINI_API_KEY is missing. A local model-question paper was created.",
      });
    }

    const prompt = `
You are an expert English assessment designer for Bangladesh secondary-school learners.

Create one traditional 20-mark English model question paper for Class ${classLevel}, based ONLY on the supplied textbook passage.

Difficulty:
${difficulty.toUpperCase()}

${difficultyInstructions(
  difficulty,
)}

The paper must contain exactly these four sections:

SECTION A — MCQ
- Exactly 5 questions
- Exactly 4 meaningful options for each question
- 1 mark each

SECTION B — QUESTIONS FROM THE PASSAGE
- Exactly 5 short-answer comprehension questions
- Each expected answer should be one or two sentences
- Include 2 to 5 answer-key keywords for fair scoring
- 1 mark each

SECTION C — FILL IN THE BLANKS WITHOUT CLUES
- Exactly 5 sentences
- Each sentence must contain exactly one visible blank written as _____
- Do not provide a clue box
- Include acceptedAnswers
- 1 mark each

SECTION D — FILL IN THE BLANKS WITH CLUES
- Exactly 5 sentences
- Each sentence must contain exactly one visible blank written as _____
- Provide one shuffled clueBox containing the five answers
- Include acceptedAnswers
- 1 mark each

STRICT RULES:
1. Return valid JSON only.
2. Do not use Markdown or code fences.
3. Use only information supported by the passage.
4. Do not ask about page numbers, OCR, formatting, pictures, labels or isolated fragments.
5. Keep all language appropriate for Class ${classLevel}.
6. Never describe this as a Class 6 paper unless classLevel is 6.
7. Every section must contain exactly 5 questions.
8. The passage field should contain a clean, coherent passage selected from the supplied context.
9. correctAnswerIndex must be an integer from 0 to 3.
10. Every fill-in sentence must include _____.

Return this exact structure:
{
  "title": "Traditional English Model Test",
  "passage": "Clean coherent source passage",
  "instructions": [
    "Answer all questions.",
    "Read the passage carefully."
  ],
  "sections": {
    "mcq": [
      {
        "question": "Question text",
        "options": [
          "Option one",
          "Option two",
          "Option three",
          "Option four"
        ],
        "correctAnswerIndex": 0,
        "explanation": "Short explanation"
      }
    ],
    "passageQuestions": [
      {
        "question": "Question text",
        "expectedAnswer": "Expected answer",
        "keywords": [
          "keyword one",
          "keyword two"
        ],
        "explanation": "Short explanation"
      }
    ],
    "fillWithoutClues": [
      {
        "sentence": "Sentence with one _____ blank.",
        "acceptedAnswers": [
          "answer"
        ],
        "explanation": "Short explanation"
      }
    ],
    "fillWithClues": {
      "clueBox": [
        "word one",
        "word two",
        "word three",
        "word four",
        "word five"
      ],
      "questions": [
        {
          "sentence": "Sentence with one _____ blank.",
          "acceptedAnswers": [
            "answer"
          ],
          "explanation": "Short explanation"
        }
      ]
    }
  }
}

TEXTBOOK CONTEXT:
${combinedContext}
`;

    const geminiResponse =
      await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          model,
        )}:generateContent?key=${encodeURIComponent(
          apiKey,
        )}`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature:
                difficulty === "hard"
                  ? 0.5
                  : 0.25,
              responseMimeType:
                "application/json",
            },
          }),
        },
      );

    const rawApiResponse =
      await geminiResponse.text();

    if (!geminiResponse.ok) {
      return NextResponse.json({
        success: true,
        paper: fallback,
        source:
          "local-fallback",
        warning:
          `Gemini returned ${geminiResponse.status}. A local model-question paper was created instead.`,
      });
    }

    const apiResult =
      JSON.parse(
        rawApiResponse,
      ) as UnknownRecord;

    const candidates =
      Array.isArray(
        apiResult.candidates,
      )
        ? apiResult.candidates
        : [];

    const firstCandidate =
      asRecord(candidates[0]);

    const content =
      asRecord(
        firstCandidate.content,
      );

    const parts =
      Array.isArray(
        content.parts,
      )
        ? content.parts
        : [];

    const firstPart =
      asRecord(parts[0]);

    const generatedText =
      typeof firstPart.text ===
      "string"
        ? firstPart.text
        : "";

    if (!generatedText) {
      return NextResponse.json({
        success: true,
        paper: fallback,
        source:
          "local-fallback",
        warning:
          "Gemini returned no usable content. A local model-question paper was created instead.",
      });
    }

    let parsed: unknown = {};

    try {
      parsed = JSON.parse(
        extractJsonText(
          generatedText,
        ),
      );
    } catch {
      parsed = {};
    }

    const paper =
      normalizeGeneratedPaper(
        parsed,
        fallback,
      );

    return NextResponse.json({
      success: true,
      paper,
      source:
        "gemini-validated",
    });
  } catch (error) {
    console.error(
      "Model quiz generation failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Model question generation failed.",
      },
      {
        status: 500,
      },
    );
  }
}
