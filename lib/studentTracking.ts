import { prisma } from "@/lib/prisma";

export function getBangladeshDateKey(date = new Date()) {
  const bangladeshTime = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  return bangladeshTime.toISOString().slice(0, 10);
}

export async function findOrCreateStudentByKey(studentKey: string) {
  const cleanKey = studentKey?.trim() || "demo-student";

  return prisma.student.upsert({
    where: {
      studentKey: cleanKey,
    },
    update: {},
    create: {
      studentKey: cleanKey,
      name: cleanKey,
      memory: {
        create: {},
      },
    },
  });
}

type DailyIncrementInput = {
  studentKey: string;
  minutesStudied?: number;
  lessonsOpened?: number;
  linesSelected?: number;
  aiInteractions?: number;
  quizAttempts?: number;
  quizScore?: number;
  quizTotal?: number;
  gamesPlayed?: number;
  gameScore?: number;
};

export async function incrementDailyStudyRecord(input: DailyIncrementInput) {
  const student = await findOrCreateStudentByKey(input.studentKey);
  const dateKey = getBangladeshDateKey();

  return prisma.dailyStudyRecord.upsert({
    where: {
      studentId_dateKey: {
        studentId: student.id,
        dateKey,
      },
    },
    update: {
      minutesStudied: {
        increment: input.minutesStudied ?? 0,
      },
      lessonsOpened: {
        increment: input.lessonsOpened ?? 0,
      },
      linesSelected: {
        increment: input.linesSelected ?? 0,
      },
      aiInteractions: {
        increment: input.aiInteractions ?? 0,
      },
      quizAttempts: {
        increment: input.quizAttempts ?? 0,
      },
      quizScore: {
        increment: input.quizScore ?? 0,
      },
      quizTotal: {
        increment: input.quizTotal ?? 0,
      },
      gamesPlayed: {
        increment: input.gamesPlayed ?? 0,
      },
      gameScore: {
        increment: input.gameScore ?? 0,
      },
    },
    create: {
      studentId: student.id,
      dateKey,
      minutesStudied: input.minutesStudied ?? 0,
      lessonsOpened: input.lessonsOpened ?? 0,
      linesSelected: input.linesSelected ?? 0,
      aiInteractions: input.aiInteractions ?? 0,
      quizAttempts: input.quizAttempts ?? 0,
      quizScore: input.quizScore ?? 0,
      quizTotal: input.quizTotal ?? 0,
      gamesPlayed: input.gamesPlayed ?? 0,
      gameScore: input.gameScore ?? 0,
    },
  });
}
