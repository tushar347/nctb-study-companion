type GeminiPart = {
  text?: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: GeminiPart[];
    };
  }[];
};

type HelperOutput = {
  simple: string;
  bangla: string;
  grammar: string;
};

function cleanJson(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function fallbackHelper(lineText: string): HelperOutput {
  return {
    simple:
      "AI helper is not configured yet. Add GEMINI_API_KEY in .env.local and restart the server.",
    bangla:
      "AI অনুবাদ এখনো চালু হয়নি। .env.local ফাইলে GEMINI_API_KEY যোগ করে server restart করতে হবে।",
    grammar: `Selected line: "${lineText}"`,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const lineText = body.lineText;

    if (!lineText || typeof lineText !== "string") {
      return Response.json(
        {
          error: "lineText is required",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    if (!apiKey) {
      return Response.json({
        helper: fallbackHelper(lineText),
      });
    }

    const prompt = `
You are an English-Bangla textbook study assistant for Class 6 students in Bangladesh.

The student selected this textbook line:
"${lineText}"

Return ONLY valid JSON. No markdown. No code fences.

JSON format:
{
  "simple": "A very simple English explanation for a Class 6 student.",
  "bangla": "The actual Bangla meaning/translation of the selected line. Do not write a generic explanation. Translate the meaning naturally.",
  "grammar": "Short grammar help: subject, verb, tense, important phrase, or punctuation."
}

Rules:
- The Bangla field must be the real Bangla meaning of the selected line.
- Keep the answer short and student-friendly.
- If the selected line is a heading, objective, bullet point, dialogue, or question, translate it naturally.
`;

    const geminiResponse = await fetch(
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
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiResponse.ok) {
      return Response.json({
        helper: fallbackHelper(lineText),
      });
    }

    const geminiData = (await geminiResponse.json()) as GeminiResponse;

    const generatedText =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!generatedText) {
      return Response.json({
        helper: fallbackHelper(lineText),
      });
    }

    const helper = JSON.parse(cleanJson(generatedText)) as HelperOutput;

    return Response.json({ helper });
  } catch {
    return Response.json(
      {
        error: "OCR helper failed",
      },
      { status: 500 }
    );
  }
}
