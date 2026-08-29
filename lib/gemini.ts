import { repairMojibake } from "@/lib/fixMojibake";

export type GeminiAction = "explain" | "bangla" | "grammar";

const MAX_TEXT_LENGTH = 2500;

export function normalizeStudyText(value: string) {
  const cleaned = value
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();

  if (!cleaned) {
    throw new Error("Please select some text first.");
  }

  if (cleaned.length > MAX_TEXT_LENGTH) {
    throw new Error(
      "Please select a shorter passage. The selected text is too long for the AI helper.",
    );
  }

  return cleaned;
}

export function toGeminiAction(value: string | undefined): GeminiAction {
  switch (value) {
    case "bangla":
      return "bangla";
    case "grammar":
      return "grammar";
    case "explain":
    default:
      return "explain";
  }
}

function getPrompt(action: GeminiAction, text: string) {
  const safeText = normalizeStudyText(text);

  if (action === "bangla") {
    return `You are a Class 6 English teacher in Bangladesh.
Translate the following English text into natural Bangla.
Preserve the original meaning.
Do not add unrelated information.
Return only the translation/meaning.

Text:
${safeText}`;
  }

  if (action === "grammar") {
    return `You are a Class 6 English grammar teacher in Bangladesh.
Analyze the following sentence for a beginner.
Explain the subject, verb, object when applicable, tense, and important grammar structure in simple English.
Mention important parts of speech only when they help the student.
Keep the answer short and student-friendly.

Text:
${safeText}`;
  }

  return `You are an English teacher for Class 6 students in Bangladesh.
Explain the selected NCTB English text simply.
Use only the provided text as the main source.
Do not invent textbook context.
Keep the explanation concise and beginner-friendly.

Text:
${safeText}`;
}

export async function generateStudyAid({
  action,
  text,
}: {
  action: GeminiAction;
  text: string;
}) {
  const safeText = normalizeStudyText(text);
  const apiKey = (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY ??
    ""
  ).trim();

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing.");
  }

  const orderedModels = [
    process.env.GEMINI_MODEL?.trim(),
    "gemini-3.6-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
  ].filter((value): value is string => Boolean(value));

  let lastError: Error | null = null;

  for (const model of Array.from(new Set(orderedModels))) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: getPrompt(action, safeText) }],
              },
            ],
            generationConfig: {
              temperature: 0.3,
            },
          }),
        },
      );

      if (!response.ok) {
        const details = await response.text().catch(() => "");
        const message =
          details && details.length < 300
            ? `Gemini request failed: ${details}`
            : "Gemini request failed.";

        if (response.status === 404) {
          lastError = new Error(message);
          continue;
        }

        throw new Error(message);
      }

      const data = (await response.json()) as {
        candidates?: {
          content?: {
            parts?: Array<{ text?: string }>;
          };
        }[];
      };

      const output =
        data.candidates
          ?.flatMap((candidate) => candidate.content?.parts ?? [])
          .map((part) => part.text ?? "")
          .join("")
          .trim() ?? "";

      if (!output) {
        throw new Error("Gemini returned an empty response.");
      }

      return repairMojibake(output);
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Gemini request failed.");

      if (
        error instanceof Error &&
        error.message.includes("GEMINI_API_KEY is missing")
      ) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("Gemini request failed.");
}
