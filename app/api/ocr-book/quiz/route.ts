type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: {
        text?: string;
      }[];
    };
  }[];
};

function cleanJson(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function getUsefulLines(lessonText: string) {
  return lessonText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8)
    .slice(0, 12);
}

function fallbackQuiz(lessonTitle: string, lessonText: string): QuizQuestion[] {
  const lines = getUsefulLines(lessonText);
  const firstLine = lines[0] ?? lessonTitle;
  const secondLine = lines[1] ?? firstLine;
  const thirdLine = lines[2] ?? secondLine;

  return [
    {
      id: "fallback-q1",
      question: "What is the lesson mainly connected with?",
      options: [lessonTitle, "A sports score", "A weather report", "A cooking recipe"],
      correctAnswer: lessonTitle,
      explanation: `The lesson title shows that the main topic is "${lessonTitle}".`,
    },
    {
      id: "fallback-q2",
      question: "Which line appears in this lesson?",
      options: [firstLine, "The moon is made of cheese.", "The train flew in the sky.", "The book was never opened."],
      correctAnswer: firstLine,
      explanation: "This line was taken directly from the selected lesson text.",
    },
    {
      id: "fallback-q3",
      question: "Which line should students read carefully for understanding?",
      options: [secondLine, "Throw away the textbook.", "Do not answer any question.", "Never read instructions."],
      correctAnswer: secondLine,
      explanation: "This line belongs to the selected lesson and should be understood carefully.",
    },
    {
      id: "fallback-q4",
      question: "What does the reader help students practise?",
      options: ["Reading comprehension", "Driving", "Cooking", "Playing cricket only"],
      correctAnswer: "Reading comprehension",
      explanation: "The reader helps students understand textbook lines.",
    },
    {
      id: "fallback-q5",
      question: "Which selected lesson line is real?",
      options: [thirdLine, "The sea is above the clouds.", "Students should delete the lesson.", "There are no words in the book."],
      correctAnswer: thirdLine,
      explanation: "This option is taken from the OCR-backed lesson text.",
    },
  ];
}

function normalizeQuestions(value: unknown): QuizQuestion[] {
  const maybeObject = value as { questions?: QuizQuestion[] };
  const questions = Array.isArray(maybeObject.questions)
    ? maybeObject.questions
    : [];

  return questions.slice(0, 5).map((question, index) => {
    const options = Array.isArray(question.options)
      ? question.options.slice(0, 4).map(String)
      : [];

    const correctAnswer = String(question.correctAnswer ?? options[0] ?? "");

    if (correctAnswer && !options.includes(correctAnswer)) {
      options[0] = correctAnswer;
    }

    return {
      id: question.id || `q${index + 1}`,
      question: String(question.question ?? `Question ${index + 1}`),
      options,
      correctAnswer,
      explanation: String(
        question.explanation ?? "This answer follows from the selected lesson."
      ),
    };
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const lessonNo = body.lessonNo;
    const lessonTitle = body.lessonTitle;
    const lessonText = body.lessonText;

    if (!lessonNo || !lessonTitle || !lessonText) {
      return Response.json(
        {
          error: "lessonNo, lessonTitle, and lessonText are required",
        },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    if (!apiKey) {
      return Response.json({
        questions: fallbackQuiz(lessonTitle, lessonText),
        source: "fallback",
      });
    }

    const prompt = `
You are a Class 6 English teacher in Bangladesh.

Create exactly 5 multiple-choice questions from this textbook lesson.

Lesson number: ${lessonNo}
Lesson title: ${lessonTitle}

Lesson text:
${String(lessonText).slice(0, 9000)}

Return ONLY valid JSON. No markdown. No code fences.

JSON format:
{
  "questions": [
    {
      "id": "q1",
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correctAnswer": "Exact correct option text",
      "explanation": "Short explanation why the answer is correct"
    }
  ]
}

Rules:
- Make the questions student-friendly.
- Use the selected lesson only.
- Include comprehension, vocabulary, dialogue, and grammar-style questions when possible.
- correctAnswer must exactly match one option.
- Explanation must be simple and useful.
`;

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
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.45,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      return Response.json({
        questions: fallbackQuiz(lessonTitle, lessonText),
        source: "fallback",
      });
    }

    const geminiData = (await response.json()) as GeminiResponse;

    const generatedText =
      geminiData.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim() ?? "";

    if (!generatedText) {
      return Response.json({
        questions: fallbackQuiz(lessonTitle, lessonText),
        source: "fallback",
      });
    }

    const parsed = JSON.parse(cleanJson(generatedText));
    const questions = normalizeQuestions(parsed);

    if (questions.length === 0) {
      return Response.json({
        questions: fallbackQuiz(lessonTitle, lessonText),
        source: "fallback",
      });
    }

    return Response.json({
      questions,
      source: "gemini",
    });
  } catch {
    return Response.json(
      {
        error: "Quiz generation failed",
      },
      { status: 500 }
    );
  }
}
