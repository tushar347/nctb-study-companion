export const runtime = "nodejs";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  if (!apiKey) {
    return Response.json({
      success: false,
      problem: "GEMINI_API_KEY is not loading from .env.local",
      hasKey: false,
      model,
    });
  }

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
              parts: [{ text: "Say only OK" }],
            },
          ],
        }),
      },
    );

    const text = await response.text();

    return Response.json({
      success: response.ok,
      hasKey: true,
      keyLength: apiKey.length,
      model,
      status: response.status,
      statusText: response.statusText,
      responsePreview: text.slice(0, 800),
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        hasKey: true,
        model,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
