import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Difficulty = "easy" | "medium" | "hard";

type MatchingRequest = {
  selectedText?: string;
  pageNumber?: number;
  lessonNo?: number;
  difficulty?: Difficulty;
  pairCount?: number;
};

type MatchingPair = {
  id: string;
  left: string;
  right: string;
  explanation: string;
};

type UnknownRecord = Record<string, unknown>;

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

function cleanLine(value: unknown): string {
  return removeMarkdown(value)
    .replace(
      /^\s*(?:[•●▪◦*–—-]+|\(?\d+\)?[.)]|[A-Da-d][.)])\s*/g,
      "",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function isJunk(value: unknown): boolean {
  const text = cleanLine(value);
  const lower = text.toLowerCase();

  if (!text) return true;
  if (text.length < 3) return true;
  if (!/[A-Za-z]/.test(text)) return true;
  if (/^[A-Da-d][.)]?$/.test(text)) return true;
  if (/^\d+[.)]?$/.test(text)) return true;
  if (/^[^\p{L}\p{N}]+$/u.test(text)) return true;

  const junkValues = new Set([
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
    "1",
    "2",
    "3",
    "4",
    "1.",
    "2.",
    "3.",
    "4.",
  ]);

  return junkValues.has(lower);
}

function cleanContext(value: unknown): string {
  return removeMarkdown(value)
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .filter((line) => !isJunk(line))
    .filter((line) => line.length >= 8)
    .join("\n")
    .slice(0, 8000);
}

function splitSentences(value: string): string[] {
  return value
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => cleanLine(sentence))
    .filter((sentence) => sentence.length >= 22)
    .filter((sentence) => /[A-Za-z]{3,}/.test(sentence))
    .filter((sentence) => !isJunk(sentence));
}

async function loadPageContext(
  pageNumber?: number,
): Promise<string> {
  if (
    !pageNumber ||
    !Number.isInteger(pageNumber) ||
    pageNumber < 1
  ) {
    return "";
  }

  const fileName = `page-${String(
    pageNumber,
  ).padStart(3, "0")}.json`;

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
    const raw = await readFile(
      filePath,
      "utf-8",
    );

    const page = JSON.parse(
      raw.replace(/^\uFEFF/, ""),
    );

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
          .map(
            (line: UnknownRecord) =>
              line.cleanText ??
              line.text ??
              "",
          )
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
              line.cleanText ??
              line.text ??
              "",
          )
          .join("\n"),
      );
    }

    return "";
  } catch {
    return "";
  }
}

function extractJson(value: string): string {
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

  const arrayStart =
    cleaned.indexOf("[");

  const arrayEnd =
    cleaned.lastIndexOf("]");

  if (
    arrayStart >= 0 &&
    arrayEnd > arrayStart
  ) {
    return cleaned.slice(
      arrayStart,
      arrayEnd + 1,
    );
  }

  return cleaned;
}

function normalizePairs(
  rawValue: unknown,
  requestedCount: number,
): MatchingPair[] {
  let rawPairs: unknown[] = [];

  if (Array.isArray(rawValue)) {
    rawPairs = rawValue;
  } else if (
    rawValue &&
    typeof rawValue === "object" &&
    Array.isArray(
      (rawValue as UnknownRecord)
        .pairs,
    )
  ) {
    rawPairs = (
      rawValue as UnknownRecord
    ).pairs as unknown[];
  }

  const result: MatchingPair[] = [];
  const usedLeft = new Set<string>();
  const usedRight = new Set<string>();

  for (const rawPair of rawPairs) {
    if (
      !rawPair ||
      typeof rawPair !== "object"
    ) {
      continue;
    }

    const pair =
      rawPair as UnknownRecord;

    const left = cleanLine(
      pair.left ??
        pair.prompt ??
        pair.term ??
        pair.first,
    );

    const right = cleanLine(
      pair.right ??
        pair.match ??
        pair.meaning ??
        pair.second,
    );

    const explanation =
      cleanLine(
        pair.explanation ??
          pair.reason ??
          `${left} correctly matches ${right}.`,
      ) ||
      `${left} correctly matches ${right}.`;

    if (isJunk(left)) continue;
    if (isJunk(right)) continue;
    if (left.length < 4) continue;
    if (right.length < 4) continue;

    if (
      left.toLowerCase() ===
      right.toLowerCase()
    ) {
      continue;
    }

    if (
      usedLeft.has(
        left.toLowerCase(),
      ) ||
      usedRight.has(
        right.toLowerCase(),
      )
    ) {
      continue;
    }

    usedLeft.add(
      left.toLowerCase(),
    );

    usedRight.add(
      right.toLowerCase(),
    );

    result.push({
      id: `pair-${result.length + 1}`,
      left,
      right,
      explanation,
    });

    if (
      result.length >=
      requestedCount
    ) {
      break;
    }
  }

  return result;
}

function createFallbackPairs(
  context: string,
  requestedCount: number,
): MatchingPair[] {
  const sentences =
    splitSentences(context);

  const result: MatchingPair[] = [];

  for (const sentence of sentences) {
    const words =
      sentence.split(/\s+/);

    if (words.length < 8) {
      continue;
    }

    const splitPoint = Math.ceil(
      words.length / 2,
    );

    const left = cleanLine(
      `${words
        .slice(0, splitPoint)
        .join(" ")} ...`,
    );

    const right = cleanLine(
      `... ${words
        .slice(splitPoint)
        .join(" ")}`,
    );

    if (isJunk(left)) continue;
    if (isJunk(right)) continue;

    result.push({
      id: `fallback-${result.length + 1}`,
      left,
      right,
      explanation: sentence,
    });

    if (
      result.length >=
      requestedCount
    ) {
      break;
    }
  }

  return result;
}

function getDifficultyRules(
  difficulty: Difficulty,
): string {
  if (difficulty === "easy") {
    return `
Difficulty: EASY
Use direct relationships such as character-action, place-description, object-use, or sentence beginning-ending.
Keep both sides short and clear.
`;
  }

  if (difficulty === "hard") {
    return `
Difficulty: HARD
Use inference, cause-effect, contextual meaning, grammar function, or closely related ideas.
Each pair must still have only one correct match.
`;
  }

  return `
Difficulty: MEDIUM
Use comprehension, vocabulary in context, character-action, sentence continuation, or cause-effect.
Require moderate reasoning.
`;
}

export async function POST(
  request: Request,
) {
  try {
    const body =
      (await request.json()) as MatchingRequest;

    const difficulty: Difficulty =
      body.difficulty === "easy" ||
      body.difficulty === "hard"
        ? body.difficulty
        : "medium";

    const pairCount = Math.min(
      8,
      Math.max(
        4,
        Number(body.pairCount ?? 6),
      ),
    );

    const selectedText =
      cleanContext(
        body.selectedText,
      );

    const pageContext =
      await loadPageContext(
        Number(body.pageNumber),
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
      combinedContext.length < 20
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Not enough clean textbook content was found. Select a meaningful textbook line in the Reader.",
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
      const fallbackPairs =
        createFallbackPairs(
          combinedContext,
          pairCount,
        );

      if (
        fallbackPairs.length < 4
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Not enough meaningful sentences were available to create the game.",
          },
          { status: 422 },
        );
      }

      return NextResponse.json({
        success: true,
        source:
          "local-sentence-fallback",
        difficulty,
        pairs: fallbackPairs,
        warning:
          "The Gemini key was unavailable. A local sentence-matching game was generated.",
      });
    }

    const prompt = `
You are a Class 6 English teacher and educational-game designer.

Create exactly ${pairCount} meaningful matching pairs from the textbook context.

The game presents:
LEFT = a meaningful phrase, sentence beginning, character, event, action, cause, or idea.
RIGHT = its correct continuation, result, meaning, description, or relationship.

${getDifficultyRules(
  difficulty,
)}

STRICT RULES:
1. Return valid JSON only.
2. Return no Markdown or code fences.
3. Never use bullets, dots, punctuation-only items, isolated letters, page numbers, exercise numbers, picture labels, or OCR fragments.
4. Never use ".", "A.", "B.", "1.", "-", or symbol-only text.
5. Both sides must contain meaningful English words.
6. Do not create identical word-to-word pairs.
7. Each left item must have exactly one correct right-side match.
8. Do not ask about pictures, layout, bullets, or page formatting.
9. Do not duplicate left or right items.
10. Keep language suitable for a Bangladeshi Class 6 student.

Return exactly:
{
  "pairs": [
    {
      "left": "Meaningful prompt",
      "right": "Correct matching idea",
      "explanation": "Short explanation"
    }
  ]
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
                  { text: prompt },
                ],
              },
            ],
            generationConfig: {
              temperature:
                difficulty === "hard"
                  ? 0.5
                  : 0.3,
              responseMimeType:
                "application/json",
            },
          }),
        },
      );

    const rawGeminiResponse =
      await geminiResponse.text();

    if (!geminiResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `Gemini API returned ${geminiResponse.status}.`,
          details:
            rawGeminiResponse.slice(
              0,
              500,
            ),
        },
        { status: 502 },
      );
    }

    const geminiData =
      JSON.parse(
        rawGeminiResponse,
      );

    const generatedText =
      geminiData?.candidates?.[0]
        ?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini returned no matching-game content.",
        },
        { status: 502 },
      );
    }

    let parsedContent: unknown;

    try {
      parsedContent = JSON.parse(
        extractJson(
          generatedText,
        ),
      );
    } catch {
      parsedContent = null;
    }

    let pairs = normalizePairs(
      parsedContent,
      pairCount,
    );

    if (pairs.length < 4) {
      const fallbackPairs =
        createFallbackPairs(
          combinedContext,
          pairCount,
        );

      const usedLeft = new Set(
        pairs.map((pair) =>
          pair.left.toLowerCase(),
        ),
      );

      for (
        const fallbackPair of
        fallbackPairs
      ) {
        if (
          !usedLeft.has(
            fallbackPair.left.toLowerCase(),
          )
        ) {
          pairs.push(
            fallbackPair,
          );

          usedLeft.add(
            fallbackPair.left.toLowerCase(),
          );
        }

        if (
          pairs.length >=
          pairCount
        ) {
          break;
        }
      }
    }

    if (pairs.length < 4) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Not enough valid matching pairs survived validation.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      source:
        "gemini-validated",
      difficulty,
      generatedCount:
        pairs.length,
      pairs,
    });
  } catch (error) {
    console.error(
      "Matching route error:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Matching game generation failed.",
      },
      { status: 500 },
    );
  }
}