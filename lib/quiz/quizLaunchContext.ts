export const QUIZ_LAUNCH_CONTEXT_STORAGE_KEY =
  "nctb.quizLaunchContext.v1";

export type QuizContextSource =
  | "reader"
  | "url-reconstruction"
  | "legacy";

export type LessonResolution =
  | "mapped"
  | "unavailable";

export type QuizContextLine = {
  id: string;
  lineNumber: number;
  text: string;
  cleanText?: string;
};

export type QuizLaunchContextV1 = {
  schemaVersion: 1;
  contextId: string;
  createdAt: string;
  source: QuizContextSource;

  book: {
    id: string;
    title: string;
    classLevel: number;
  };

  lesson: {
    number: number | null;
    title: string | null;
    resolution: LessonResolution;
  };

  page: {
    number: number;
    source: string | null;
  };

  selectedLine: {
    id: string;
    lineNumber: number;
    text: string;
  } | null;

  passage: {
    id: null;
    text: string;
    source: "page-ocr" | "selected-line";
    lineIds: string[];
  };
};

type CreateQuizLaunchContextInput = {
  contextId?: string;
  source?: QuizContextSource;

  book: {
    id: string;
    title: string;
    classLevel: number;
  };

  lesson: {
    number: number | null;
    title: string | null;
    resolution: LessonResolution;
  };

  page: {
    number: number;
    source?: string | null;
  };

  selectedLine?: QuizContextLine | null;
  pageLines: QuizContextLine[];
};

function createContextId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return [
    "quiz",
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
  ].join("-");
}

function cleanLineText(line: QuizContextLine) {
  return String(
    line.cleanText ?? line.text ?? "",
  )
    .replace(/\s+/g, " ")
    .trim();
}

function isPositiveInteger(value: unknown) {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0
  );
}

function isNonEmptyString(value: unknown) {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

export function createQuizLaunchContext(
  input: CreateQuizLaunchContextInput,
): QuizLaunchContextV1 {
  if (!isNonEmptyString(input.book.id)) {
    throw new Error(
      "Quiz context requires a book identifier.",
    );
  }

  if (
    !Number.isInteger(input.book.classLevel) ||
    input.book.classLevel < 1
  ) {
    throw new Error(
      "Quiz context requires a valid class level.",
    );
  }

  if (!isPositiveInteger(input.page.number)) {
    throw new Error(
      "Quiz context requires a valid page number.",
    );
  }

  const usableLines = input.pageLines
    .map((line) => ({
      id: String(line.id ?? "").trim(),
      lineNumber: Number(line.lineNumber),
      text: cleanLineText(line),
    }))
    .filter(
      (line) =>
        line.id &&
        isPositiveInteger(line.lineNumber) &&
        line.text,
    );

  const selectedLine = input.selectedLine
    ? {
        id: String(
          input.selectedLine.id ?? "",
        ).trim(),
        lineNumber: Number(
          input.selectedLine.lineNumber,
        ),
        text: cleanLineText(
          input.selectedLine,
        ),
      }
    : null;

  if (
    selectedLine &&
    (!selectedLine.id ||
      !isPositiveInteger(
        selectedLine.lineNumber,
      ) ||
      !selectedLine.text)
  ) {
    throw new Error(
      "The selected OCR line is invalid.",
    );
  }

  const pagePassage = usableLines
    .map((line) => line.text)
    .join("\n")
    .trim();

  const passageText =
    pagePassage || selectedLine?.text || "";

  if (!passageText) {
    throw new Error(
      "The current OCR page has no usable text for a quiz.",
    );
  }

  return {
    schemaVersion: 1,
    contextId:
      input.contextId?.trim() ||
      createContextId(),
    createdAt: new Date().toISOString(),
    source: input.source ?? "reader",

    book: {
      id: input.book.id.trim(),
      title:
        input.book.title.trim() ||
        input.book.id.trim(),
      classLevel: input.book.classLevel,
    },

    lesson: {
      number:
        input.lesson.number !== null &&
        isPositiveInteger(
          input.lesson.number,
        )
          ? input.lesson.number
          : null,
      title:
        input.lesson.title?.trim() ||
        null,
      resolution:
        input.lesson.resolution,
    },

    page: {
      number: input.page.number,
      source:
        input.page.source?.trim() ||
        null,
    },

    selectedLine,

    passage: {
      id: null,
      text: passageText,
      source: pagePassage
        ? "page-ocr"
        : "selected-line",
      lineIds: usableLines.map(
        (line) => line.id,
      ),
    },
  };
}

export function isQuizLaunchContextV1(
  value: unknown,
): value is QuizLaunchContextV1 {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return false;
  }

  const context =
    value as Partial<QuizLaunchContextV1>;

  return Boolean(
    context.schemaVersion === 1 &&
      isNonEmptyString(context.contextId) &&
      isNonEmptyString(
        context.createdAt,
      ) &&
      context.book &&
      isNonEmptyString(
        context.book.id,
      ) &&
      typeof context.book.classLevel ===
        "number" &&
      Number.isInteger(
        context.book.classLevel,
      ) &&
      context.page &&
      isPositiveInteger(
        context.page.number,
      ) &&
      context.lesson &&
      (context.lesson.resolution ===
        "mapped" ||
        context.lesson.resolution ===
          "unavailable") &&
      context.passage &&
      isNonEmptyString(
        context.passage.text,
      ) &&
      Array.isArray(
        context.passage.lineIds,
      ),
  );
}

export function writeQuizLaunchContext(
  context: QuizLaunchContextV1,
) {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(
    QUIZ_LAUNCH_CONTEXT_STORAGE_KEY,
    JSON.stringify(context),
  );
}

export function readQuizLaunchContext(
  expectedContextId?: string | null,
): QuizLaunchContextV1 | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = sessionStorage.getItem(
    QUIZ_LAUNCH_CONTEXT_STORAGE_KEY,
  );

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isQuizLaunchContextV1(parsed)) {
      return null;
    }

    if (
      expectedContextId &&
      parsed.contextId !== expectedContextId
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function inferClassLevel(bookId: string) {
  const match = bookId.match(
    /class(\d+)/i,
  );

  const value = match
    ? Number(match[1])
    : 0;

  return Number.isInteger(value) &&
    value > 0
    ? value
    : 0;
}

export function readLegacyQuizLaunchContext():
  | QuizLaunchContextV1
  | null {
  if (typeof window === "undefined") {
    return null;
  }

  const bookId =
    localStorage
      .getItem("selectedBookId")
      ?.trim() ?? "";

  const pageNumber = Number(
    localStorage.getItem(
      "selectedBookPdfPage",
    ),
  );

  const selectedText =
    localStorage
      .getItem("selectedLine")
      ?.trim() ?? "";

  if (
    !bookId ||
    !isPositiveInteger(pageNumber) ||
    !selectedText
  ) {
    return null;
  }

  const classLevel =
    Number(
      localStorage.getItem(
        "selectedClass",
      ),
    ) ||
    inferClassLevel(bookId);

  if (
    !Number.isInteger(classLevel) ||
    classLevel < 1
  ) {
    return null;
  }

  const lessonValue = Number(
    localStorage.getItem(
      "selectedLessonNo",
    ),
  );

  const lessonNumber =
    isPositiveInteger(lessonValue)
      ? lessonValue
      : null;

  return createQuizLaunchContext({
    source: "legacy",
    book: {
      id: bookId,
      title:
        localStorage.getItem(
          "selectedBookTitle",
        ) ||
        `English For Today — Class ${classLevel}`,
      classLevel,
    },
    lesson: {
      number: lessonNumber,
      title:
        localStorage.getItem(
          "selectedLessonTitle",
        ) || null,
      resolution: lessonNumber
        ? "mapped"
        : "unavailable",
    },
    page: {
      number: pageNumber,
      source: "legacy-local-storage",
    },
    selectedLine: {
      id: `legacy-${bookId}-${pageNumber}`,
      lineNumber: 1,
      text: selectedText,
    },
    pageLines: [
      {
        id: `legacy-${bookId}-${pageNumber}`,
        lineNumber: 1,
        text: selectedText,
      },
    ],
  });
}

export function buildQuizHref(
  context: QuizLaunchContextV1,
) {
  const parameters =
    new URLSearchParams({
      contextId: context.contextId,
      bookId: context.book.id,
      page: String(
        context.page.number,
      ),
    });

  if (context.lesson.number) {
    parameters.set(
      "lesson",
      String(context.lesson.number),
    );
  }

  return `/quiz?${parameters.toString()}`;
}
