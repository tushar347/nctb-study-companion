export type QuizHistoryItem = {
  lessonNo: number;
  lessonTitle?: string;
  score: number;
  total: number;
  wrongAnswers: string[];
  attemptedAt: string;
};

export type StudentMemory = {
  studentId: string;
  openedLessons: number[];
  selectedLines: string[];
  usedTools: string[];
  weakAreas: string[];
  quizHistory: QuizHistoryItem[];
};

const memoryStore: Record<string, StudentMemory> = {};

export function getStudentMemory(studentId: string): StudentMemory {
  if (!memoryStore[studentId]) {
    memoryStore[studentId] = {
      studentId,
      openedLessons: [],
      selectedLines: [],
      usedTools: [],
      weakAreas: [],
      quizHistory: [],
    };
  }

  return memoryStore[studentId];
}

export function updateStudentMemory(
  studentId: string,
  update: Partial<StudentMemory>,
): StudentMemory {
  const current = getStudentMemory(studentId);

  memoryStore[studentId] = {
    ...current,
    ...update,
  };

  return memoryStore[studentId];
}

export function addOpenedLesson(studentId: string, lessonNo: number) {
  const current = getStudentMemory(studentId);

  return updateStudentMemory(studentId, {
    openedLessons: Array.from(new Set([...current.openedLessons, lessonNo])),
  });
}

export function addSelectedLine(studentId: string, selectedLine: string) {
  const current = getStudentMemory(studentId);

  return updateStudentMemory(studentId, {
    selectedLines: [...current.selectedLines, selectedLine],
  });
}

export function addUsedTool(studentId: string, toolName: string) {
  const current = getStudentMemory(studentId);

  return updateStudentMemory(studentId, {
    usedTools: [...current.usedTools, toolName],
  });
}

export function addWeakArea(studentId: string, weakArea: string) {
  const current = getStudentMemory(studentId);

  return updateStudentMemory(studentId, {
    weakAreas: Array.from(new Set([...current.weakAreas, weakArea])),
  });
}

export function addQuizHistory(
  studentId: string,
  quizItem: QuizHistoryItem,
): StudentMemory {
  const current = getStudentMemory(studentId);

  return updateStudentMemory(studentId, {
    quizHistory: [...current.quizHistory, quizItem],
  });
}
