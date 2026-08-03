import { NextResponse } from "next/server";

import {
  chatJson,
  deriveEvidenceQuote,
  findExactPassageFragment,
  LocalAiError,
  normalizeKey,
  normalizeText,
  requireText,
} from "@/lib/local-ai/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRecord = Record<
  string,
  unknown
>;

type McqQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  evidenceQuote: string;
};

type ShortQuestion = {
  question: string;
  answer: string;
  evidenceQuote: string;
};

const mcqSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "question",
    "options",
    "correct_answer",
  ],
  properties: {
    question: {
      type: "string",
    },
    options: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "string",
      },
    },
    correct_answer: {
      type: "string",
    },
  },
};

const shortQaSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "question",
    "answer",
  ],
  properties: {
    question: {
      type: "string",
    },
    answer: {
      type: "string",
    },
  },
};

function isRecord(
  value: unknown,
): value is JsonRecord {
  return Boolean(
    value &&
      typeof value ===
        "object" &&
      !Array.isArray(value),
  );
}

function validQuestion(
  value: unknown,
) {
  const question =
    normalizeText(value);

  if (question.length < 8) {
    throw new Error(
      "The question is too short.",
    );
  }

  return question.endsWith("?")
    ? question
    : `${question}?`;
}

function validateMcq(
  value: unknown,
  passage: string,
): McqQuestion {
  if (!isRecord(value)) {
    throw new Error(
      "The MCQ response is not an object.",
    );
  }

  const question =
    validQuestion(
      value.question,
    );

  if (
    !Array.isArray(
      value.options,
    ) ||
    value.options.length !== 4
  ) {
    throw new Error(
      "The MCQ must contain four options.",
    );
  }

  const options =
    value.options.map(
      (option) =>
        normalizeText(option),
    );

  if (
    options.some(
      (option) => !option,
    )
  ) {
    throw new Error(
      "An MCQ option is empty.",
    );
  }

  if (
    new Set(
      options.map(
        normalizeKey,
      ),
    ).size !== 4
  ) {
    throw new Error(
      "The MCQ options are not unique.",
    );
  }

  const rawCorrectAnswer =
    normalizeText(
      value.correct_answer,
    );

  const matchingOptionIndex =
    options.findIndex(
      (option) =>
        normalizeKey(option) ===
        normalizeKey(
          rawCorrectAnswer,
        ),
    );

  if (matchingOptionIndex < 0) {
    throw new Error(
      "The correct answer does not match an option.",
    );
  }

  const exactAnswer =
    findExactPassageFragment(
      passage,
      rawCorrectAnswer,
    );

  if (!exactAnswer) {
    throw new Error(
      "The correct answer is not an exact passage phrase.",
    );
  }

  options[
    matchingOptionIndex
  ] = exactAnswer;

  return {
    question,
    options,
    correctAnswer:
      exactAnswer,
    evidenceQuote:
      deriveEvidenceQuote(
        passage,
        exactAnswer,
      ),
  };
}

function validateShortQa(
  value: unknown,
  passage: string,
): ShortQuestion {
  if (!isRecord(value)) {
    throw new Error(
      "The short-answer response is not an object.",
    );
  }

  const question =
    validQuestion(
      value.question,
    );

  const rawAnswer =
    normalizeText(
      value.answer,
    );

  if (
    rawAnswer.split(/\s+/).length >
    20
  ) {
    throw new Error(
      "The short answer contains more than 20 words.",
    );
  }

  const exactAnswer =
    findExactPassageFragment(
      passage,
      rawAnswer,
    );

  if (!exactAnswer) {
    throw new Error(
      "The short answer is not an exact passage phrase.",
    );
  }

  return {
    question,
    answer:
      exactAnswer,
    evidenceQuote:
      deriveEvidenceQuote(
        passage,
        exactAnswer,
      ),
  };
}

async function generateMcq(
  passage: string,
  classLevel: number,
) {
  let correction = "";
  let finalError =
    "MCQ generation failed.";

  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {
    const prompt = `
PASSAGE:
${passage}

Create one useful multiple-choice question for a Class ${classLevel} student.

Rules:
- Use only the passage.
- Ask about an important fact, action, meaning, or idea.
- Provide exactly four short and unique options.
- Copy correct_answer exactly from the passage.
- correct_answer must exactly match one option.
- Do not ask about page numbers, publishers, OCR, formatting, contents lists, editions, or copyright.
- Return only the requested JSON object.

${
  correction
    ? `Previous response problem: ${correction}
Correct that problem.`
    : ""
}
`.trim();

    try {
      const result =
        await chatJson<unknown>({
          messages: [
            {
              role: "system",
              content:
                "You generate grounded NCTB English assessment items. Never use outside information.",
            },
            {
              role: "user",
              content:
                prompt,
            },
          ],
          schema:
            mcqSchema,
          temperature: 0,
          seed:
            400 + attempt,
          maximumGeneratedTokens:
            220,
        });

      return {
        item:
          validateMcq(
            result.data,
            passage,
          ),
        attempts:
          attempt,
        durationMilliseconds:
          result
            .durationMilliseconds,
        model:
          result.model,
      };
    } catch (error) {
      finalError =
        error instanceof Error
          ? error.message
          : "MCQ validation failed.";

      correction =
        finalError;
    }
  }

  throw new LocalAiError(
    finalError,
    422,
  );
}

async function generateShortQa(
  passage: string,
  classLevel: number,
) {
  let correction = "";
  let finalError =
    "Short-answer generation failed.";

  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {
    const prompt = `
PASSAGE:
${passage}

Create one useful short-answer question for a Class ${classLevel} student.

Rules:
- Use only the passage.
- Ask about an important fact, action, meaning, or idea.
- Copy answer exactly from the passage.
- The answer must be one continuous phrase of no more than 20 words.
- Do not ask about page numbers, publishers, OCR, formatting, contents lists, editions, or copyright.
- Return only the requested JSON object.

${
  correction
    ? `Previous response problem: ${correction}
Correct that problem.`
    : ""
}
`.trim();

    try {
      const result =
        await chatJson<unknown>({
          messages: [
            {
              role: "system",
              content:
                "You generate grounded NCTB English assessment items. Never use outside information.",
            },
            {
              role: "user",
              content:
                prompt,
            },
          ],
          schema:
            shortQaSchema,
          temperature: 0,
          seed:
            800 + attempt,
          maximumGeneratedTokens:
            150,
        });

      return {
        item:
          validateShortQa(
            result.data,
            passage,
          ),
        attempts:
          attempt,
        durationMilliseconds:
          result
            .durationMilliseconds,
        model:
          result.model,
      };
    } catch (error) {
      finalError =
        error instanceof Error
          ? error.message
          : "Short-answer validation failed.";

      correction =
        finalError;
    }
  }

  throw new LocalAiError(
    finalError,
    422,
  );
}

function errorResponse(
  error: unknown,
) {
  const status =
    error instanceof LocalAiError
      ? error.status
      : 500;

  return NextResponse.json(
    {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Local quiz generation failed.",
    },
    {
      status,
    },
  );
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as {
        passage?: unknown;
        classLevel?: unknown;
        bookId?: unknown;
        pageNumber?: unknown;
      };

    const passage =
      requireText(
        body.passage,
        "Passage",
        60,
        12_000,
      );

    const classLevel = Number(
      body.classLevel,
    );

    if (
      classLevel !== 6 &&
      classLevel !== 7
    ) {
      throw new LocalAiError(
        "The local pilot currently supports Classes 6 and 7.",
        400,
      );
    }

    const startedAt =
      performance.now();

    const mcq =
      await generateMcq(
        passage,
        classLevel,
      );

    const shortQa =
      await generateShortQa(
        passage,
        classLevel,
      );

    return NextResponse.json({
      success: true,
      model:
        mcq.model,
      source: {
        bookId:
          normalizeText(
            body.bookId,
          ) || null,
        pageNumber:
          Number.isInteger(
            Number(
              body.pageNumber,
            ),
          )
            ? Number(
                body.pageNumber,
              )
            : null,
        classLevel,
      },
      quiz: {
        mcq:
          mcq.item,
        shortQa:
          shortQa.item,
      },
      attempts: {
        mcq:
          mcq.attempts,
        shortQa:
          shortQa.attempts,
      },
      durationMilliseconds:
        Math.round(
          performance.now() -
            startedAt,
        ),
    });
  } catch (error) {
    return errorResponse(
      error,
    );
  }
}
