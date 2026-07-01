import { prisma } from "@/lib/prisma";

function parseArray<T>(value: string | null | undefined): T[] {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uniqueArray<T>(items: T[]) {
  return Array.from(new Set(items));
}

export async function ensureStudent(studentKey: string, name?: string) {
  const student = await prisma.student.upsert({
    where: { studentKey },
    update: name ? { name } : {},
    create: {
      studentKey,
      name,
    },
  });

  await prisma.studentMemory.upsert({
    where: { studentId: student.id },
    update: {},
    create: {
      studentId: student.id,
    },
  });

  return student;
}

export async function updateMemoryAfterAgent({
  studentKey,
  lessonNo,
  selectedLine,
  toolUsed,
}: {
  studentKey: string;
  lessonNo: number;
  selectedLine: string;
  toolUsed: string;
}) {
  const student = await ensureStudent(studentKey);

  const memory = await prisma.studentMemory.findUnique({
    where: { studentId: student.id },
  });

  const openedLessons = uniqueArray<number>([
    ...parseArray<number>(memory?.openedLessonsJson),
    lessonNo,
  ]);

  const selectedLines = [
    ...parseArray<string>(memory?.selectedLinesJson),
    selectedLine,
  ];

  const usedTools = [...parseArray<string>(memory?.usedToolsJson), toolUsed];

  return prisma.studentMemory.update({
    where: { studentId: student.id },
    data: {
      openedLessonsJson: JSON.stringify(openedLessons),
      selectedLinesJson: JSON.stringify(selectedLines),
      usedToolsJson: JSON.stringify(usedTools),
    },
  });
}

export async function addWeakArea({
  studentKey,
  weakArea,
}: {
  studentKey: string;
  weakArea: string;
}) {
  const student = await ensureStudent(studentKey);

  const memory = await prisma.studentMemory.findUnique({
    where: { studentId: student.id },
  });

  const weakAreas = uniqueArray<string>([
    ...parseArray<string>(memory?.weakAreasJson),
    weakArea,
  ]);

  return prisma.studentMemory.update({
    where: { studentId: student.id },
    data: {
      weakAreasJson: JSON.stringify(weakAreas),
    },
  });
}

export async function logResearchEvent({
  studentKey,
  lessonNo,
  eventType,
  selectedLine,
  toolUsed,
  score,
  total,
  metadata,
}: {
  studentKey: string;
  lessonNo?: number;
  eventType: string;
  selectedLine?: string;
  toolUsed?: string;
  score?: number;
  total?: number;
  metadata?: Record<string, unknown>;
}) {
  const student = await ensureStudent(studentKey);

  return prisma.researchEvent.create({
    data: {
      studentId: student.id,
      lessonNo,
      eventType,
      selectedLine,
      toolUsed,
      score,
      total,
      metadataJson: metadata ? JSON.stringify(metadata) : undefined,
    },
  });
}

export async function saveChatMessage({
  studentKey,
  lessonNo,
  selectedLine,
  toolUsed,
  question,
  answer,
  source,
}: {
  studentKey: string;
  lessonNo?: number;
  selectedLine?: string;
  toolUsed?: string;
  question?: string;
  answer: string;
  source: string;
}) {
  const student = await ensureStudent(studentKey);

  return prisma.chatMessage.create({
    data: {
      studentId: student.id,
      lessonNo,
      selectedLine,
      toolUsed,
      question,
      answer,
      source,
    },
  });
}

export async function saveQuizAttempt({
  studentKey,
  lessonNo,
  lessonTitle,
  score,
  total,
  wrongAnswers,
  weakAreas,
}: {
  studentKey: string;
  lessonNo: number;
  lessonTitle?: string;
  score: number;
  total: number;
  wrongAnswers: string[];
  weakAreas: string[];
}) {
  const student = await ensureStudent(studentKey);

  return prisma.quizAttempt.create({
    data: {
      studentId: student.id,
      lessonNo,
      lessonTitle,
      score,
      total,
      wrongAnswersJson: JSON.stringify(wrongAnswers),
      weakAreasJson: JSON.stringify(weakAreas),
    },
  });
}

export async function getStudentResearchSummary(studentKey: string) {
  const student = await ensureStudent(studentKey);

  const memory = await prisma.studentMemory.findUnique({
    where: { studentId: student.id },
  });

  const recentEvents = await prisma.researchEvent.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const recentChats = await prisma.chatMessage.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const quizAttempts = await prisma.quizAttempt.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return {
    studentKey: student.studentKey,
    name: student.name,
    memory: {
      openedLessons: parseArray<number>(memory?.openedLessonsJson),
      selectedLines: parseArray<string>(memory?.selectedLinesJson),
      usedTools: parseArray<string>(memory?.usedToolsJson),
      weakAreas: parseArray<string>(memory?.weakAreasJson),
    },
    recentEvents,
    recentChats,
    quizAttempts,
  };
}

export async function getMemorySummaryForAgent(studentKey: string) {
  const summary = await getStudentResearchSummary(studentKey);

  return {
    openedLessons: summary.memory.openedLessons,
    selectedLineCount: summary.memory.selectedLines.length,
    recentlySelectedLines: summary.memory.selectedLines.slice(-5),
    usedTools: summary.memory.usedTools.slice(-10),
    weakAreas: summary.memory.weakAreas,
    recentQuizAttempts: summary.quizAttempts.slice(0, 5),
  };
}
