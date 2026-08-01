export type WordReplacement = {
  position: number;
  expected: string;
  received: string;
};

export type ReadAloudEvaluation = {
  expectedText: string;
  transcript: string;
  expectedWords: string[];
  spokenWords: string[];
  matchedWords: string[];
  missingWords: string[];
  extraWords: string[];
  replacements: WordReplacement[];
  accuracyScore: number;
  completenessScore: number;
  overallScore: number;
  wordsPerMinute: number | null;
  durationMs: number | null;
};

export type SpeakingEvaluation = {
  sourceText: string;
  promptText: string;
  transcript: string;
  sourceKeywords: string[];
  matchedKeywords: string[];
  missedKeywords: string[];
  relevanceScore: number;
  responseLengthScore: number;
  fluencyScore: number | null;
  overallScore: number;
  wordsPerMinute: number | null;
  durationMs: number | null;
};

type AlignmentStep =
  | {
      type: "match";
      expected: string;
      received: string;
      position: number;
    }
  | {
      type: "replacement";
      expected: string;
      received: string;
      position: number;
    }
  | {
      type: "missing";
      expected: string;
      position: number;
    }
  | {
      type: "extra";
      received: string;
      position: number;
    };

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "and",
  "are",
  "because",
  "before",
  "being",
  "but",
  "can",
  "could",
  "did",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "her",
  "him",
  "his",
  "how",
  "into",
  "its",
  "may",
  "more",
  "not",
  "our",
  "out",
  "she",
  "should",
  "some",
  "than",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "those",
  "through",
  "too",
  "was",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

export function normalizeVoiceWords(
  value: unknown,
) {
  return (
    String(value ?? "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .match(/[a-z]+(?:'[a-z]+)?/g) ?? []
  );
}

function resolveDuration(
  durationInput: unknown,
) {
  const value = Number(
    durationInput,
  );

  return (
    Number.isFinite(value) &&
    value > 0 &&
    value <= 10 * 60 * 1000
  )
    ? Math.round(value)
    : null;
}

function resolveWordsPerMinute(
  wordCount: number,
  durationMs: number | null,
) {
  if (!durationMs) {
    return null;
  }

  return Math.max(
    1,
    Math.round(
      (wordCount / durationMs) *
        60000,
    ),
  );
}

function alignWords(
  expectedWords: string[],
  spokenWords: string[],
) {
  const rows =
    expectedWords.length + 1;

  const columns =
    spokenWords.length + 1;

  const distance = Array.from(
    { length: rows },
    () =>
      Array<number>(
        columns,
      ).fill(0),
  );

  for (
    let row = 0;
    row < rows;
    row += 1
  ) {
    distance[row][0] = row;
  }

  for (
    let column = 0;
    column < columns;
    column += 1
  ) {
    distance[0][column] =
      column;
  }

  for (
    let row = 1;
    row < rows;
    row += 1
  ) {
    for (
      let column = 1;
      column < columns;
      column += 1
    ) {
      const cost =
        expectedWords[row - 1] ===
        spokenWords[column - 1]
          ? 0
          : 1;

      distance[row][column] =
        Math.min(
          distance[row - 1][
            column
          ] + 1,
          distance[row][
            column - 1
          ] + 1,
          distance[row - 1][
            column - 1
          ] + cost,
        );
    }
  }

  const steps: AlignmentStep[] =
    [];

  let row =
    expectedWords.length;

  let column =
    spokenWords.length;

  while (
    row > 0 ||
    column > 0
  ) {
    if (
      row > 0 &&
      column > 0 &&
      expectedWords[row - 1] ===
        spokenWords[column - 1] &&
      distance[row][column] ===
        distance[row - 1][
          column - 1
        ]
    ) {
      steps.push({
        type: "match",
        expected:
          expectedWords[
            row - 1
          ],
        received:
          spokenWords[
            column - 1
          ],
        position: row,
      });

      row -= 1;
      column -= 1;
      continue;
    }

    if (
      row > 0 &&
      column > 0 &&
      distance[row][column] ===
        distance[row - 1][
          column - 1
        ] +
          1
    ) {
      steps.push({
        type:
          "replacement",
        expected:
          expectedWords[
            row - 1
          ],
        received:
          spokenWords[
            column - 1
          ],
        position: row,
      });

      row -= 1;
      column -= 1;
      continue;
    }

    if (
      row > 0 &&
      distance[row][column] ===
        distance[row - 1][
          column
        ] +
          1
    ) {
      steps.push({
        type: "missing",
        expected:
          expectedWords[
            row - 1
          ],
        position: row,
      });

      row -= 1;
      continue;
    }

    if (column > 0) {
      steps.push({
        type: "extra",
        received:
          spokenWords[
            column - 1
          ],
        position: row + 1,
      });

      column -= 1;
    }
  }

  return steps.reverse();
}

export function evaluateReadAloud(
  expectedTextInput: unknown,
  transcriptInput: unknown,
  durationInput?: unknown,
): ReadAloudEvaluation {
  const expectedText =
    String(
      expectedTextInput ?? "",
    ).trim();

  const transcript =
    String(
      transcriptInput ?? "",
    ).trim();

  const expectedWords =
    normalizeVoiceWords(
      expectedText,
    );

  const spokenWords =
    normalizeVoiceWords(
      transcript,
    );

  if (
    expectedWords.length === 0
  ) {
    throw new Error(
      "The textbook line has no readable English words.",
    );
  }

  if (
    spokenWords.length === 0
  ) {
    throw new Error(
      "No spoken words were recognized.",
    );
  }

  const steps = alignWords(
    expectedWords,
    spokenWords,
  );

  const matchedWords =
    steps
      .filter(
        (
          step,
        ): step is Extract<
          AlignmentStep,
          { type: "match" }
        > =>
          step.type ===
          "match",
      )
      .map(
        (step) =>
          step.expected,
      );

  const missingWords =
    steps
      .filter(
        (
          step,
        ): step is Extract<
          AlignmentStep,
          { type: "missing" }
        > =>
          step.type ===
          "missing",
      )
      .map(
        (step) =>
          step.expected,
      );

  const extraWords =
    steps
      .filter(
        (
          step,
        ): step is Extract<
          AlignmentStep,
          { type: "extra" }
        > =>
          step.type ===
          "extra",
      )
      .map(
        (step) =>
          step.received,
      );

  const replacements =
    steps
      .filter(
        (
          step,
        ): step is Extract<
          AlignmentStep,
          {
            type:
              "replacement";
          }
        > =>
          step.type ===
          "replacement",
      )
      .map((step) => ({
        position:
          step.position,
        expected:
          step.expected,
        received:
          step.received,
      }));

  const accuracyDenominator =
    Math.max(
      expectedWords.length,
      spokenWords.length,
      1,
    );

  const accuracyScore =
    Math.round(
      (matchedWords.length /
        accuracyDenominator) *
        100,
    );

  const completenessScore =
    Math.round(
      (matchedWords.length /
        expectedWords.length) *
        100,
    );

  const overallScore =
    Math.round(
      accuracyScore * 0.7 +
        completenessScore * 0.3,
    );

  const durationMs =
    resolveDuration(
      durationInput,
    );

  return {
    expectedText,
    transcript,
    expectedWords,
    spokenWords,
    matchedWords,
    missingWords,
    extraWords,
    replacements,
    accuracyScore,
    completenessScore,
    overallScore,
    wordsPerMinute:
      resolveWordsPerMinute(
        spokenWords.length,
        durationMs,
      ),
    durationMs,
  };
}

export function extractSourceKeywords(
  sourceText: unknown,
) {
  const keywords: string[] =
    [];

  const seen =
    new Set<string>();

  for (
    const word of
      normalizeVoiceWords(
        sourceText,
      )
  ) {
    if (
      word.length < 3 ||
      STOP_WORDS.has(word) ||
      seen.has(word)
    ) {
      continue;
    }

    seen.add(word);
    keywords.push(word);
  }

  return keywords.slice(0, 12);
}

function evaluateFluency(
  wordsPerMinute:
    | number
    | null,
) {
  if (!wordsPerMinute) {
    return null;
  }

  if (
    wordsPerMinute >= 55 &&
    wordsPerMinute <= 150
  ) {
    return 100;
  }

  if (
    wordsPerMinute < 55
  ) {
    return Math.max(
      25,
      Math.round(
        (wordsPerMinute / 55) *
          100,
      ),
    );
  }

  return Math.max(
    25,
    Math.round(
      100 -
        (wordsPerMinute - 150) *
          1.2,
    ),
  );
}

export function evaluateSpeakingPractice(
  sourceTextInput: unknown,
  promptTextInput: unknown,
  transcriptInput: unknown,
  durationInput?: unknown,
): SpeakingEvaluation {
  const sourceText =
    String(
      sourceTextInput ?? "",
    ).trim();

  const promptText =
    String(
      promptTextInput ?? "",
    ).trim();

  const transcript =
    String(
      transcriptInput ?? "",
    ).trim();

  const sourceKeywords =
    extractSourceKeywords(
      sourceText,
    );

  const spokenWords =
    normalizeVoiceWords(
      transcript,
    );

  if (
    sourceKeywords.length === 0
  ) {
    throw new Error(
      "The selected textbook line has no suitable speaking keywords.",
    );
  }

  if (
    spokenWords.length === 0
  ) {
    throw new Error(
      "No spoken response was recognized.",
    );
  }

  const spokenSet =
    new Set(
      spokenWords,
    );

  const matchedKeywords =
    sourceKeywords.filter(
      (keyword) =>
        spokenSet.has(keyword),
    );

  const missedKeywords =
    sourceKeywords.filter(
      (keyword) =>
        !spokenSet.has(keyword),
    );

  const relevanceScore =
    Math.round(
      (matchedKeywords.length /
        sourceKeywords.length) *
        100,
    );

  const targetResponseLength =
    Math.max(
      8,
      Math.min(
        20,
        sourceKeywords.length +
          6,
      ),
    );

  const responseLengthScore =
    Math.min(
      100,
      Math.round(
        (spokenWords.length /
          targetResponseLength) *
          100,
      ),
    );

  const durationMs =
    resolveDuration(
      durationInput,
    );

  const wordsPerMinute =
    resolveWordsPerMinute(
      spokenWords.length,
      durationMs,
    );

  const fluencyScore =
    evaluateFluency(
      wordsPerMinute,
    );

  const overallScore =
    Math.round(
      relevanceScore * 0.65 +
        responseLengthScore *
          0.25 +
        (fluencyScore ?? 70) *
          0.1,
    );

  return {
    sourceText,
    promptText,
    transcript,
    sourceKeywords,
    matchedKeywords,
    missedKeywords,
    relevanceScore,
    responseLengthScore,
    fluencyScore,
    overallScore,
    wordsPerMinute,
    durationMs,
  };
}
