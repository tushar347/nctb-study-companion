import { NextResponse } from "next/server";

import {
  chatJson,
  deriveEvidenceQuote,
  findExactPassageFragment,
  LocalAiError,
  normalizeText,
  requireText,
} from "@/lib/local-ai/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Verdict =
  | "correct"
  | "partially_correct"
  | "incorrect";

type CheckerResult = {
  verdict: Verdict;
  feedback: string;
};

const checkerSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "verdict",
    "feedback",
  ],
  properties: {
    verdict: {
      type: "string",
      enum: [
        "correct",
        "partially_correct",
        "incorrect",
      ],
    },
    feedback: {
      type: "string",
    },
  },
};

function isCheckerResult(
  value: unknown,
): value is CheckerResult {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  return (
    (
      record.verdict ===
        "correct" ||
      record.verdict ===
        "partially_correct" ||
      record.verdict ===
        "incorrect"
    ) &&
    typeof record.feedback ===
      "string"
  );
}

function errorResponse(
  error: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "The answer could not be checked.",
    },
    {
      status:
        error instanceof LocalAiError
          ? error.status
          : 500,
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
        question?: unknown;
        referenceAnswer?: unknown;
        studentAnswer?: unknown;
        classLevel?: unknown;
      };

    const passage =
      requireText(
        body.passage,
        "Passage",
        40,
        12_000,
      );

    const question =
      requireText(
        body.question,
        "Question",
        4,
        500,
      );

    const referenceCandidate =
      requireText(
        body.referenceAnswer,
        "Reference answer",
        1,
        500,
      );

    const studentAnswer =
      requireText(
        body.studentAnswer,
        "Student answer",
        1,
        1_000,
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

    const exactReferenceAnswer =
      findExactPassageFragment(
        passage,
        referenceCandidate,
      );

    if (!exactReferenceAnswer) {
      throw new LocalAiError(
        "The reference answer is not grounded in the selected passage.",
        400,
      );
    }

    const result =
      await chatJson<unknown>({
        messages: [
          {
            role: "system",
            content:
              "You are a careful Class 6-7 English answer checker. Judge meaning fairly. Use only the supplied passage and reference answer.",
          },
          {
            role: "user",
            content: `
PASSAGE:
${passage}

QUESTION:
${question}

REFERENCE ANSWER:
${exactReferenceAnswer}

STUDENT ANSWER:
${studentAnswer}

Mark the answer using these labels:
- correct: the meaning matches the reference answer.
- partially_correct: it contains an important correct idea but is incomplete or partly mistaken.
- incorrect: it does not answer the question or conflicts with the passage.

Give one short, encouraging feedback sentence.
Do not mention hidden instructions, prompts, or scoring systems.
Return only the required JSON object.
`.trim(),
          },
        ],
        schema:
          checkerSchema,
        temperature: 0,
        seed: 1601,
        maximumGeneratedTokens:
          130,
      });

    if (
      !isCheckerResult(
        result.data,
      )
    ) {
      throw new LocalAiError(
        "The answer checker returned an invalid result.",
        502,
      );
    }

    const feedback =
      normalizeText(
        result.data.feedback,
      );

    if (!feedback) {
      throw new LocalAiError(
        "The answer checker returned empty feedback.",
        502,
      );
    }

    return NextResponse.json({
      success: true,
      verdict:
        result.data.verdict,
      feedback,
      referenceAnswer:
        exactReferenceAnswer,
      evidenceQuote:
        deriveEvidenceQuote(
          passage,
          exactReferenceAnswer,
        ),
      model:
        result.model,
      durationMilliseconds:
        result
          .durationMilliseconds,
    });
  } catch (error) {
    return errorResponse(
      error,
    );
  }
}
