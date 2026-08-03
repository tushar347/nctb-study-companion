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
  ).toLocaleLowerCase();
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
  const normalizedCandidate =
    normalizeText(candidate);

  if (!normalizedCandidate) {
    return null;
  }

  const pattern = normalizedCandidate
    .split(/\s+/)
    .map(
      escapeRegularExpression,
    )
    .join("\\s+");

  try {
    const match = new RegExp(
      pattern,
      "iu",
    ).exec(passage);

    return match?.[0] ?? null;
  } catch {
    return null;
  }
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
