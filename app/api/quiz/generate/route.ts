import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Difficulty = "easy" | "medium" | "hard";

type QuizRequest = {
  selectedText?: string;
  pageNumber?: number;
  lessonNo?: number;
  difficulty?: Difficulty;
  questionCount?: number;
};

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
};

type UnknownRecord = Record<string, unknown>;

const JUNK_VALUES = new Set([
  ".",
  ",",
  ":",
  ";",
  "-",
  "_",
  "•",
  "●",
  "▪",
  "◦",
  "a",
  "b",
  "c",
  "d",
  "a.",
  "b.",
  "c.",
  "d.",
  "a)",
  "b)",
  "c)",
  "d)",
  "1",
  "2",
  "3",
  "4",
  "1.",
  "2.",
  "3.",
  "4.",
]);

function removeMarkdown(value: unknown): string {
  return String(value ?? "")
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/<[^>]+>/g, " ")
    .trim();
}

function cleanSingleLine(value: unknown): string {
  return removeMarkdown(value)
    .replace(
      /^\s*(?:[•●▪◦*–—-]+|\(?\d+\)?[.)]|[A-Da-d][.)])\s*/g,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function isJunkText(value: unknown): boolean {
  const text = cleanSingleLine(value);
  const lower = text.toLowerCase();

  if (!text) return true;
  if (text.length < 2) return true;
  if (JUNK_VALUES.has(lower)) return true;
  if (!/[A-Za-z]/.test(text)) return true;
  if (/^[A-Da-d][.)]?$/.test(text)) return true;
  if (/^\d+[.)]?$/.test(text)) return true;
  if (/^[^\p{L}\p{N}]+$/u.test(text)) return true;

  return false;
}

function cleanContext(value: unknown): string {
  const raw = removeMarkdown(value);

  return raw
    .split(/\r?\n/)
    .map((line) => cleanSingleLine(line))
    .filter((line) => !isJunkText(line))
    .filter((line) => line.length >= 8)
    .join("\n")
    .slice(0, 7000);
}

function splitMeaningfulSentences(value: string): string[] {
  return value
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanSingleLine(sentence))
    .filter((sentence) => sentence.length >= 20)
    .filter((sentence) => /[A-Za-z]{3,}/.test(sentence))
    .filter((sentence) => !isJunkText(sentence));
}

async function loadPageContext(pageNumber?: number): Promise<string> {
  if (
    !pageNumber ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1
  ) {
    return "";
  }

  const fileName = `page-${String(pageNumber).padStart(3, "0")}.json`;

  const filePath = path.join(
    process.cwd(),
    "public",
    "ocr",
    "books",
    "class6-english",
    "pages",
    fileName,
  );

  try {
    const raw = await readFile(filePath, "utf-8");
    const page = JSON.parse(raw.replace(/^\uFEFF/, ""));

    if (typeof page.aiReadyText === "string") {
      return cleanContext(page.aiReadyText);
    }

    if (Array.isArray(page.aiReadyLines)) {
      return cleanContext(
        page.aiReadyLines
          .map((line: UnknownRecord) => line.text)
          .join("\n"),
      );
    }

    if (Array.isArray(page.lines)) {
      return cleanContext(
        page.lines
          .filter(
            (line: UnknownRecord) =>
              line.aiReady !== false,
          )
          .map(
            (line: UnknownRecord) =>
              line.cleanText ?? line.text,
          )
          .join("\n"),
      );
    }

    return "";
  } catch {
    return "";
  }
}

function getDifficultyInstructions(
  difficulty: Difficulty,
): string {
  if (difficulty === "easy") {
    return `
Difficulty: EASY
- Use direct facts, simple vocabulary, and basic sentence meaning.
- Use clear distractors that are obviously different but still real words.
- Avoid complicated inference.
`;
  }

  if (difficulty === "hard") {
    return `
Difficulty: HARD
- Test inference, grammar application, context, and close reading.
- Distractors must be plausible and similar in quality.
- Do not create trick questions based on punctuation or formatting.
`;
  }

  return `
Difficulty: MEDIUM
- Mix comprehension, vocabulary-in-context, and grammar.
- Require some reasoning, but keep questions suitable for Class 6.
- Distractors must be believable and based on the passage.
`;
}

function extractJsonText(value: string): string {
  const cleaned = value
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");

  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return cleaned.slice(arrayStart, arrayEnd + 1);
  }

  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");

  if (objectStart >= 0 && objectEnd > objectStart) {
    return cleaned.slice(objectStart, objectEnd + 1);
  }

  return cleaned;
}

function normalizeQuizQuestions(
  rawValue: unknown,
  requestedCount: number,
): QuizQuestion[] {
  let rawQuestions: unknown[] = [];

  if (Array.isArray(rawValue)) {
    rawQuestions = rawValue;
  } else if (
    rawValue &&
    typeof rawValue === "object" &&
    Array.isArray((rawValue as UnknownRecord).questions)
  ) {
    rawQuestions = (rawValue as UnknownRecord)
      .questions as unknown[];
  }

  const normalized: QuizQuestion[] = [];

  for (const rawQuestion of rawQuestions) {
    if (
      !rawQuestion ||
      typeof rawQuestion !== "object"
    ) {
      continue;
    }

    const record = rawQuestion as UnknownRecord;

    const question = cleanSingleLine(
      record.question ??
        record.prompt ??
        record.questionText,
    );

    const rawOptions =
      record.options ??
      record.choices ??
      record.answers;

    if (!Array.isArray(rawOptions)) {
      continue;
    }

    const options = rawOptions
      .map((option) => {
        if (
          option &&
          typeof option === "object"
        ) {
          const optionRecord =
            option as UnknownRecord;

          return cleanSingleLine(
            optionRecord.text ??
              optionRecord.value ??
              optionRecord.label,
          );
        }

        return cleanSingleLine(option);
      })
      .filter((option) => !isJunkText(option));

    const uniqueOptions = Array.from(
      new Map(
        options.map((option) => [
          option.toLowerCase(),
          option,
        ]),
      ).values(),
    );

    if (isJunkText(question)) continue;
    if (question.length < 10) continue;
    if (uniqueOptions.length !== 4) continue;

    let correctAnswerIndex = Number(
      record.correctAnswerIndex ??
        record.answerIndex ??
        record.correctIndex,
    );

    if (
      !Number.isInteger(correctAnswerIndex) ||
      correctAnswerIndex < 0 ||
      correctAnswerIndex > 3
    ) {
      const correctAnswer = cleanSingleLine(
        record.correctAnswer ??
          record.answer,
      );

      correctAnswerIndex =
        uniqueOptions.findIndex(
          (option) =>
            option.toLowerCase() ===
            correctAnswer.toLowerCase(),
        );
    }

    if (
      correctAnswerIndex < 0 ||
      correctAnswerIndex > 3
    ) {
      continue;
    }

    const explanation =
      cleanSingleLine(
        record.explanation ??
          record.reason ??
          "The answer is supported by the textbook context.",
      ) ||
      "The answer is supported by the textbook context.";

    normalized.push({
      id: `question-${normalized.length + 1}`,
      question,
      options: uniqueOptions,
      correctAnswerIndex,
      explanation,
    });

    if (normalized.length >= requestedCount) {
      break;
    }
  }

  return normalized;
}

function makeFallbackQuestions(
  context: string,
  count: number,
): QuizQuestion[] {
  const sentences =
    splitMeaningfulSentences(context);

  const wordPool = Array.from(
    new Set(
      sentences
        .flatMap((sentence) =>
          sentence.match(/[A-Za-z]{4,}/g) ?? [],
        )
        .map((word) => word.toLowerCase())
        .filter(
          (word) =>
            ![
              "this",
              "that",
              "with",
              "from",
              "have",
              "were",
              "they",
              "their",
              "there",
              "about",
              "after",
              "before",
              "would",
              "could",
              "should",
              "which",
              "where",
            ].includes(word),
        ),
    ),
  );

  const questions: QuizQuestion[] = [];

  for (const sentence of sentences) {
    const candidates =
      sentence.match(/[A-Za-z]{5,}/g) ?? [];

    const answer = candidates.find(
      (word) =>
        ![
          "there",
          "their",
          "about",
          "after",
          "before",
          "which",
          "where",
          "would",
          "could",
          "should",
        ].includes(word.toLowerCase()),
    );

    if (!answer) continue;

    const distractors = wordPool
      .filter(
        (word) =>
          word !== answer.toLowerCase(),
      )
      .filter(
        (word) =>
          Math.abs(word.length - answer.length) <= 4,
      )
      .slice(
        questions.length,
        questions.length + 3,
      );

    if (distractors.length < 3) continue;

    const questionText = sentence.replace(
      new RegExp(`\\b${answer}\\b`, "i"),
      "_____",
    );

    const options = [
      answer,
      ...distractors.map(
        (word) =>
          word.charAt(0).toUpperCase() +
          word.slice(1),
      ),
    ];

    const rotatedOptions = [
      options[1],
      options[0],
      options[2],
      options[3],
    ];

    questions.push({
      id: `fallback-${questions.length + 1}`,
      question:
        `Choose the correct word to complete the sentence: ${questionText}`,
      options: rotatedOptions,
      correctAnswerIndex: 1,
      explanation:
        `"${answer}" correctly completes the sentence from the textbook.`,
    });

    if (questions.length >= count) break;
  }

  return questions;
}

export async function POST(request: Request) {
  try {
    const body =
      (await request.json()) as QuizRequest;

    const difficulty: Difficulty =
      body.difficulty === "easy" ||
      body.difficulty === "hard"
        ? body.difficulty
        : "medium";

    const questionCount = Math.min(
      10,
      Math.max(
        3,
        Number(body.questionCount ?? 5),
      ),
    );

    const selectedText = cleanContext(
      body.selectedText,
    );

    const pageContext =
      await loadPageContext(
        Number(body.pageNumber),
      );

    const combinedContext = cleanContext(
      [selectedText, pageContext]
        .filter(Boolean)
        .join("\n"),
    );

    if (combinedContext.length < 20) {
      return NextResponse.json(
        {
          success: false,
          error:
            "There is not enough clean textbook text to generate a quiz. Select a meaningful sentence or open an OCR-processed page.",
        },
        { status: 400 },
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    const model =
      process.env.GEMINI_MODEL ??
      "gemini-2.5-flash";

    if (!apiKey) {
      const fallbackQuestions =
        makeFallbackQuestions(
          combinedContext,
          questionCount,
        );

      return NextResponse.json({
        success: true,
        source: "local-fallback",
        difficulty,
        questions: fallbackQuestions,
        warning:
          "GEMINI_API_KEY is missing. Local cleaned-text questions were generated.",
      });
    }

    const prompt = `
You are an expert Class 6 English teacher and assessment designer.

Create exactly ${questionCount} multiple-choice questions from the CLEAN TEXTBOOK CONTEXT below.

${getDifficultyInstructions(difficulty)}

STRICT RULES:
1. Return valid JSON only.
2. Do not return Markdown, code fences, headings, or commentary.
3. Each question must have exactly four meaningful options.
4. Never use punctuation marks, bullets, dots, page numbers, exercise numbers, isolated letters, picture numbers, labels, or OCR fragments as an answer option.
5. Never use options such as ".", "A.", "B.", "1.", "-", or any symbol-only text.
6. Every option must contain meaningful English words.
7. Do not ask questions about formatting, bullets, pictures, line numbers, or page layout.
8. Use only facts, vocabulary, grammar, and meaning supported by the supplied context.
9. Options must be unique.
10. correctAnswerIndex must be an integer from 0 to 3.
11. Explanations must be plain text without **, #, Markdown, or HTML.
12. Keep language appropriate for a Bangladeshi Class 6 student.

Return this exact JSON structure:
{
  "questions": [
    {
      "question": "Question text",
      "options": [
        "Meaningful option one",
        "Meaningful option two",
        "Meaningful option three",
        "Meaningful option four"
      ],
      "correctAnswerIndex": 0,
      "explanation": "A short plain-text explanation."
    }
  ]
}

CLEAN TEXTBOOK CONTEXT:
${combinedContext}
`;

    const geminiResponse = await fetch(
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
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature:
              difficulty === "hard"
                ? 0.55
                : 0.35,
            responseMimeType:
              "application/json",
          },
        }),
      },
    );

    const rawApiResponse =
      await geminiResponse.text();

    if (!geminiResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Gemini API returned ${geminiResponse.status}.`,
          details:
            rawApiResponse.slice(0, 500),
        },
        { status: 502 },
      );
    }

    const apiResult = JSON.parse(
      rawApiResponse,
    );

    const generatedText =
      apiResult?.candidates?.[0]?.content
        ?.parts?.[0]?.text;

    if (!generatedText) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini returned no quiz content.",
        },
        { status: 502 },
      );
    }

    let parsedGeneratedData: unknown;

    try {
      parsedGeneratedData = JSON.parse(
        extractJsonText(generatedText),
      );
    } catch {
      parsedGeneratedData = null;
    }

    let questions =
      normalizeQuizQuestions(
        parsedGeneratedData,
        questionCount,
      );

    if (questions.length < 3) {
      const fallbackQuestions =
        makeFallbackQuestions(
          combinedContext,
          questionCount,
        );

      const existingQuestions =
        new Set(
          questions.map((question) =>
            question.question.toLowerCase(),
          ),
        );

      for (const fallback of fallbackQuestions) {
        if (
          !existingQuestions.has(
            fallback.question.toLowerCase(),
          )
        ) {
          questions.push(fallback);
        }

        if (
          questions.length >= questionCount
        ) {
          break;
        }
      }
    }

    if (questions.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No valid questions survived quiz validation.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      source: "gemini-validated",
      difficulty,
      requestedCount: questionCount,
      generatedCount: questions.length,
      questions,
    });
  } catch (error) {
    console.error(
      "Quiz generation failed:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Quiz generation failed.",
      },
      { status: 500 },
    );
  }
}