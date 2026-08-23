export type OllamaRole =
  | "system"
  | "user"
  | "assistant";

export type OllamaMessage = {
  role: OllamaRole;
  content: string;
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  error?: string;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
  }>;
  error?: string;
};

export type StructuredChatResult<T> = {
  model: string;
  data: T;
  promptTokens: number | null;
  generatedTokens: number | null;
  totalDurationNanoseconds: number | null;
  durationMilliseconds: number;
};

export class LocalAiError extends Error {
  status: number;
  details?: unknown;

  constructor(
    message: string,
    status = 500,
    details?: unknown,
  ) {
    super(message);

    this.name = "LocalAiError";
    this.status = status;
    this.details = details;
  }
}

function removeTrailingSlashes(
  value: string,
) {
  return value.replace(
    /\/+$/,
    "",
  );
}

export function getLocalAiConfig() {
  const baseUrl = removeTrailingSlashes(
    process.env.OLLAMA_BASE_URL?.trim() ||
      "http://127.0.0.1:11434",
  );

  const model =
    process.env.LOCAL_AI_MODEL?.trim() ||
    "qwen3:latest";

  const configuredTimeout = Number(
    process.env
      .OLLAMA_REQUEST_TIMEOUT_MS,
  );

  const timeoutMilliseconds =
    Number.isFinite(configuredTimeout) &&
    configuredTimeout >= 10_000
      ? configuredTimeout
      : 180_000;

  return {
    baseUrl,
    model,
    timeoutMilliseconds,
  };
}

export function normalizeText(
  value: unknown,
) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

export function normalizeKey(
  value: unknown,
) {
  return normalizeText(
    value,
  )
    .toLocaleLowerCase()
    .replace(
      /[^\p{L}\p{N}]+/gu,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}

export function requireText(
  value: unknown,
  label: string,
  minimumLength: number,
  maximumLength: number,
) {
  const text = normalizeText(value);

  if (text.length < minimumLength) {
    throw new LocalAiError(
      `${label} is too short.`,
      400,
    );
  }

  if (text.length > maximumLength) {
    throw new LocalAiError(
      `${label} is too long.`,
      400,
    );
  }

  return text;
}

function escapeRegularExpression(
  value: string,
) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

export function findExactPassageFragment(
  passage: string,
  candidate: unknown,
) {
  const candidateText =
    normalizeText(candidate);

  if (!candidateText) {
    return null;
  }

  /*
   * First attempt:
   * exact text with flexible whitespace.
   */
  const exactPattern = candidateText
    .split(/\s+/)
    .map(
      escapeRegularExpression,
    )
    .join("\\s+");

  try {
    const exactMatch = new RegExp(
      exactPattern,
      "iu",
    ).exec(passage);

    if (exactMatch?.[0]) {
      return exactMatch[0];
    }
  } catch {
    // Continue to controlled token recovery.
  }

  /*
   * Second attempt:
   * recover the closest continuous passage span.
   *
   * This handles:
   * - punctuation differences
   * - curly apostrophes
   * - OCR spacing differences
   * - one or two small wording differences
   */
  type TokenSpan = {
    token: string;
    start: number;
    end: number;
  };

  function collectTokens(
    value: string,
  ): TokenSpan[] {
    const tokenPattern =
      /[\p{L}\p{N}]+(?:['?\-][\p{L}\p{N}]+)*/gu;

    const tokens: TokenSpan[] = [];

    for (
      const match of value.matchAll(
        tokenPattern,
      )
    ) {
      const original =
        match[0];

      const start =
        match.index ?? 0;

      const token =
        normalizeKey(original);

      if (!token) {
        continue;
      }

      tokens.push({
        token,
        start,
        end:
          start +
          original.length,
      });
    }

    return tokens;
  }

  function longestCommonSubsequence(
    left: string[],
    right: string[],
  ) {
    const previous =
      new Array(
        right.length + 1,
      ).fill(0);

    const current =
      new Array(
        right.length + 1,
      ).fill(0);

    for (
      let leftIndex = 1;
      leftIndex <= left.length;
      leftIndex++
    ) {
      current.fill(0);

      for (
        let rightIndex = 1;
        rightIndex <= right.length;
        rightIndex++
      ) {
        if (
          left[
            leftIndex - 1
          ] ===
          right[
            rightIndex - 1
          ]
        ) {
          current[
            rightIndex
          ] =
            previous[
              rightIndex - 1
            ] + 1;
        } else {
          current[
            rightIndex
          ] =
            Math.max(
              previous[
                rightIndex
              ],
              current[
                rightIndex - 1
              ],
            );
        }
      }

      for (
        let index = 0;
        index < current.length;
        index++
      ) {
        previous[index] =
          current[index];
      }
    }

    return previous[
      right.length
    ];
  }

  const passageTokens =
    collectTokens(passage);

  const candidateTokens =
    collectTokens(
      candidateText,
    ).map(
      (entry) =>
        entry.token,
    );

  if (
    passageTokens.length === 0 ||
    candidateTokens.length === 0
  ) {
    return null;
  }

  const minimumWindow =
    Math.max(
      1,
      candidateTokens.length - 3,
    );

  const maximumWindow =
    Math.min(
      passageTokens.length,
      candidateTokens.length + 4,
    );

  let bestScore = 0;
  let bestStart = -1;
  let bestEnd = -1;

  for (
    let startIndex = 0;
    startIndex <
    passageTokens.length;
    startIndex++
  ) {
    for (
      let windowLength =
        minimumWindow;
      windowLength <=
      maximumWindow;
      windowLength++
    ) {
      const endIndex =
        startIndex +
        windowLength;

      if (
        endIndex >
        passageTokens.length
      ) {
        break;
      }

      const windowTokens =
        passageTokens
          .slice(
            startIndex,
            endIndex,
          )
          .map(
            (entry) =>
              entry.token,
          );

      const commonLength =
        longestCommonSubsequence(
          candidateTokens,
          windowTokens,
        );

      const similarity =
        (
          2 *
          commonLength
        ) /
        (
          candidateTokens.length +
          windowTokens.length
        );

      const lengthPenalty =
        Math.abs(
          candidateTokens.length -
          windowTokens.length,
        ) * 0.015;

      const finalScore =
        similarity -
        lengthPenalty;

      if (
        finalScore >
        bestScore
      ) {
        bestScore =
          finalScore;

        bestStart =
          passageTokens[
            startIndex
          ].start;

        bestEnd =
          passageTokens[
            endIndex - 1
          ].end;
      }
    }
  }

  /*
   * Short answers require a higher score because
   * accidental matches are easier with fewer words.
   */
  const requiredScore =
    candidateTokens.length <= 3
      ? 0.80
      : candidateTokens.length <= 6
        ? 0.72
        : 0.66;

  if (
    bestStart < 0 ||
    bestEnd <= bestStart ||
    bestScore <
    requiredScore
  ) {
    return null;
  }

  return passage
    .slice(
      bestStart,
      bestEnd,
    )
    .trim();
}

export function deriveEvidenceQuote(
  passage: string,
  exactAnswer: string,
) {
  const locatedAnswer =
    findExactPassageFragment(
      passage,
      exactAnswer,
    );

  if (!locatedAnswer) {
    throw new LocalAiError(
      "The answer could not be located in the passage.",
      422,
    );
  }

  const answerIndex =
    passage.indexOf(locatedAnswer);

  const answerEnd =
    answerIndex + locatedAnswer.length;

  const previousBoundaries = [
    passage.lastIndexOf(
      ".",
      answerIndex - 1,
    ),
    passage.lastIndexOf(
      "?",
      answerIndex - 1,
    ),
    passage.lastIndexOf(
      "!",
      answerIndex - 1,
    ),
    passage.lastIndexOf(
      "\n",
      answerIndex - 1,
    ),
  ];

  const previousBoundary = Math.max(
    ...previousBoundaries,
  );

  const nextBoundaries = [
    passage.indexOf(
      ".",
      answerEnd,
    ),
    passage.indexOf(
      "?",
      answerEnd,
    ),
    passage.indexOf(
      "!",
      answerEnd,
    ),
    passage.indexOf(
      "\n",
      answerEnd,
    ),
  ].filter(
    (value) => value >= 0,
  );

  const quoteStart =
    previousBoundary >= 0
      ? previousBoundary + 1
      : 0;

  const quoteEnd =
    nextBoundaries.length > 0
      ? Math.min(
          ...nextBoundaries,
        ) + 1
      : passage.length;

  let quote = passage
    .slice(
      quoteStart,
      quoteEnd,
    )
    .trim();

  if (
    quote.length < locatedAnswer.length
  ) {
    quote = locatedAnswer;
  }

  if (quote.length > 360) {
    const localAnswerIndex =
      answerIndex - quoteStart;

    const left = Math.max(
      0,
      localAnswerIndex - 100,
    );

    const right = Math.min(
      quote.length,
      localAnswerIndex +
        locatedAnswer.length +
        180,
    );

    quote = quote
      .slice(
        left,
        right,
      )
      .trim();
  }

  return quote;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMilliseconds: number,
) {
  const controller =
    new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMilliseconds,
  );

  try {
    return await fetch(
      url,
      {
        ...init,
        signal: controller.signal,
        cache: "no-store",
      },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new LocalAiError(
        "The local model request timed out.",
        504,
      );
    }

    throw new LocalAiError(
      "Ollama could not be reached. Make sure Ollama is running locally.",
      503,
      error,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function listInstalledModels() {
  const config =
    getLocalAiConfig();

  const response =
    await fetchWithTimeout(
      `${config.baseUrl}/api/tags`,
      {
        method: "GET",
      },
      Math.min(
        config.timeoutMilliseconds,
        20_000,
      ),
    );

  const payload =
    (await response.json()) as
      OllamaTagsResponse;

  if (!response.ok) {
    throw new LocalAiError(
      payload.error ||
        "Ollama model information could not be loaded.",
      503,
    );
  }

  return Array.from(
    new Set(
      (payload.models ?? [])
        .map(
          (entry) =>
            entry.name ??
            entry.model ??
            "",
        )
        .filter(Boolean),
    ),
  );
}

export async function chatJson<T>(
  input: {
    messages: OllamaMessage[];
    schema: Record<
      string,
      unknown
    >;
    temperature?: number;
    seed?: number;
    contextSize?: number;
    maximumGeneratedTokens?: number;
  },
): Promise<
  StructuredChatResult<T>
> {
  const config =
    getLocalAiConfig();

  const startedAt =
    performance.now();

  const response =
    await fetchWithTimeout(
      `${config.baseUrl}/api/chat`,
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          stream: false,
          think: false,
          format: input.schema,
          keep_alive: "15m",
          messages: input.messages,
          options: {
            temperature:
              input.temperature ?? 0,
            seed:
              input.seed ?? 42,
            num_ctx:
              input.contextSize ??
              4096,
            num_predict:
              input
                .maximumGeneratedTokens ??
              320,
          },
        }),
      },
      config.timeoutMilliseconds,
    );

  const payload =
    (await response.json()) as
      OllamaChatResponse;

  if (!response.ok) {
    throw new LocalAiError(
      payload.error ||
        "The local model request failed.",
      response.status >= 400
        ? response.status
        : 502,
    );
  }

  const content = String(
    payload.message?.content ?? "",
  ).trim();

  if (!content) {
    throw new LocalAiError(
      "The local model returned an empty response.",
      502,
    );
  }

  let data: T;

  try {
    data = JSON.parse(
      content,
    ) as T;
  } catch (error) {
    throw new LocalAiError(
      "The local model returned invalid JSON.",
      502,
      {
        content,
        error,
      },
    );
  }

  return {
    model: config.model,
    data,
    promptTokens:
      typeof payload.prompt_eval_count ===
      "number"
        ? payload.prompt_eval_count
        : null,
    generatedTokens:
      typeof payload.eval_count ===
      "number"
        ? payload.eval_count
        : null,
    totalDurationNanoseconds:
      typeof payload.total_duration ===
      "number"
        ? payload.total_duration
        : null,
    durationMilliseconds:
      Math.round(
        performance.now() -
          startedAt,
      ),
  };
}
