export type SpellingInputMode =
  | "typed"
  | "voice";

export type SpellingSubstitution = {
  position: number;
  expected: string;
  received: string;
};

export type SpellingEvaluation = {
  targetWord: string;
  submittedAnswer: string;
  normalizedAnswer: string;
  isCorrect: boolean;
  accuracy: number;
  editDistance: number;
  missingLetters: string[];
  extraLetters: string[];
  substitutions: SpellingSubstitution[];
};

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "and", "are",
  "because", "before", "being", "but", "can", "could",
  "did", "does", "for", "from", "had", "has", "have",
  "her", "him", "his", "how", "into", "its", "may",
  "more", "not", "our", "out", "she", "should",
  "some", "than", "that", "the", "their", "them",
  "then", "there", "these", "they", "this", "those",
  "through", "too", "was", "were", "what", "when",
  "where", "which", "who", "will", "with", "would",
  "you", "your",
]);

const LETTER_NAMES: Record<string, string> = {
  a: "a", ay: "a",
  b: "b", be: "b", bee: "b",
  c: "c", sea: "c", see: "c",
  d: "d", dee: "d",
  e: "e", ee: "e",
  f: "f", ef: "f",
  g: "g", gee: "g",
  h: "h", aitch: "h",
  i: "i", eye: "i",
  j: "j", jay: "j",
  k: "k", kay: "k",
  l: "l", el: "l",
  m: "m", em: "m",
  n: "n", en: "n",
  o: "o", oh: "o",
  p: "p", pee: "p",
  q: "q", cue: "q",
  r: "r", are: "r",
  s: "s", ess: "s",
  t: "t", tee: "t",
  u: "u", you: "u",
  v: "v", vee: "v",
  w: "w",
  x: "x", ex: "x",
  y: "y", why: "y",
  z: "z", zee: "z", zed: "z",
};

export function normalizeSpelling(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function normalizeSpokenSpelling(
  transcript: unknown,
) {
  const source = String(transcript ?? "")
    .toLowerCase()
    .replace(/[^a-z\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!source) return "";

  const compact = normalizeSpelling(source);

  if (
    !source.includes(" ") &&
    compact.length > 1 &&
    !LETTER_NAMES[source]
  ) {
    return compact;
  }

  const tokens = source.split(" ");
  const letters: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (
      token === "letter" ||
      token === "dash" ||
      token === "hyphen"
    ) {
      continue;
    }

    if (token === "double") {
      const next = tokens[index + 1];
      if (!next) continue;

      if (next === "you") {
        letters.push("w");
        index += 1;
        continue;
      }

      const repeated = LETTER_NAMES[next];
      if (repeated) {
        letters.push(repeated, repeated);
        index += 1;
      }
      continue;
    }

    if (token === "triple" && tokens[index + 1]) {
      const repeated = LETTER_NAMES[tokens[index + 1]];
      if (repeated) {
        letters.push(repeated, repeated, repeated);
        index += 1;
      }
      continue;
    }

    const mapped = LETTER_NAMES[token];
    if (mapped) {
      letters.push(mapped);
      continue;
    }

    const normalizedToken = normalizeSpelling(token);
    if (normalizedToken.length > 1) {
      letters.push(normalizedToken);
    }
  }

  return letters.join("") || compact;
}

export function extractSpellingCandidates(
  text: unknown,
  excludedWords: string[] = [],
) {
  const excluded = new Set(
    excludedWords.map(normalizeSpelling),
  );

  const matches =
    String(text ?? "").match(/[A-Za-z]{3,14}/g) ?? [];

  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const word = normalizeSpelling(match);

    if (
      word.length < 3 ||
      word.length > 14 ||
      STOP_WORDS.has(word) ||
      excluded.has(word) ||
      seen.has(word)
    ) {
      continue;
    }

    seen.add(word);
    candidates.push(word);
  }

  return candidates.sort((left, right) => {
    const preferredLength = 7;
    const leftDistance = Math.abs(
      left.length - preferredLength,
    );
    const rightDistance = Math.abs(
      right.length - preferredLength,
    );

    if (leftDistance !== rightDistance) {
      return leftDistance - rightDistance;
    }

    return left.localeCompare(right);
  });
}

type AlignmentStep =
  | {
      type: "match";
      expected: string;
      received: string;
      position: number;
    }
  | {
      type: "substitution";
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

function alignWords(expected: string, received: string) {
  const rows = expected.length + 1;
  const columns = received.length + 1;
  const distance = Array.from(
    { length: rows },
    () => Array<number>(columns).fill(0),
  );

  for (let row = 0; row < rows; row += 1) {
    distance[row][0] = row;
  }

  for (let column = 0; column < columns; column += 1) {
    distance[0][column] = column;
  }

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitutionCost =
        expected[row - 1] === received[column - 1] ? 0 : 1;

      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + substitutionCost,
      );
    }
  }

  const steps: AlignmentStep[] = [];
  let row = expected.length;
  let column = received.length;

  while (row > 0 || column > 0) {
    if (
      row > 0 &&
      column > 0 &&
      expected[row - 1] === received[column - 1] &&
      distance[row][column] === distance[row - 1][column - 1]
    ) {
      steps.push({
        type: "match",
        expected: expected[row - 1],
        received: received[column - 1],
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
        distance[row - 1][column - 1] + 1
    ) {
      steps.push({
        type: "substitution",
        expected: expected[row - 1],
        received: received[column - 1],
        position: row,
      });
      row -= 1;
      column -= 1;
      continue;
    }

    if (
      row > 0 &&
      distance[row][column] === distance[row - 1][column] + 1
    ) {
      steps.push({
        type: "missing",
        expected: expected[row - 1],
        position: row,
      });
      row -= 1;
      continue;
    }

    if (column > 0) {
      steps.push({
        type: "extra",
        received: received[column - 1],
        position: row + 1,
      });
      column -= 1;
    }
  }

  return {
    distance: distance[expected.length][received.length],
    steps: steps.reverse(),
  };
}

export function evaluateSpelling(
  targetWord: unknown,
  submittedAnswer: unknown,
): SpellingEvaluation {
  const target = normalizeSpelling(targetWord);
  const normalizedAnswer = normalizeSpelling(
    submittedAnswer,
  );

  if (!target) {
    throw new Error(
      "A valid target word is required.",
    );
  }

  const alignment = alignWords(target, normalizedAnswer);
  const denominator = Math.max(
    target.length,
    normalizedAnswer.length,
    1,
  );

  const accuracy = Math.max(
    0,
    Math.round(
      (1 - alignment.distance / denominator) * 100,
    ),
  );

  const missingLetters = alignment.steps
    .filter(
      (
        step,
      ): step is Extract<
        AlignmentStep,
        { type: "missing" }
      > => step.type === "missing",
    )
    .map((step) => step.expected);

  const extraLetters = alignment.steps
    .filter(
      (
        step,
      ): step is Extract<
        AlignmentStep,
        { type: "extra" }
      > => step.type === "extra",
    )
    .map((step) => step.received);

  const substitutions = alignment.steps
    .filter(
      (
        step,
      ): step is Extract<
        AlignmentStep,
        { type: "substitution" }
      > => step.type === "substitution",
    )
    .map((step) => ({
      position: step.position,
      expected: step.expected,
      received: step.received,
    }));

  return {
    targetWord: target,
    submittedAnswer: String(submittedAnswer ?? ""),
    normalizedAnswer,
    isCorrect: target === normalizedAnswer,
    accuracy,
    editDistance: alignment.distance,
    missingLetters,
    extraLetters,
    substitutions,
  };
}

export function maskSpellingWord(word: string) {
  return Array.from(normalizeSpelling(word))
    .map(() => "•")
    .join(" ");
}
