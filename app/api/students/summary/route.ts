import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionStudentKey } from "@/lib/auth";

export async function GET() {
  try {
    // This route returns a student's quiz history, chat log, and study
    // records — always resolve from the session cookie, never a query
    // string, or any visitor could read another student's full profile.
    const studentKey = await getSessionStudentKey();

    const student = await prisma.student.findUnique({
      where: {
        studentKey,
      },
      include: {
        studyRecords: {
          orderBy: {
            dateKey: "desc",
          },
          take: 30,
        },
        quizAttempts: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
        gameAttempts: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
        chatMessages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        {
          error: "Student not found.",
        },
        { status: 404 },
      );
    }

    const totals = student.studyRecords.reduce(
      (acc, record) => {
        acc.minutesStudied += record.minutesStudied;
        acc.lessonsOpened += record.lessonsOpened;
        acc.linesSelected += record.linesSelected;
        acc.aiInteractions += record.aiInteractions;
        acc.quizAttempts += record.quizAttempts;
        acc.quizScore += record.quizScore;
        acc.quizTotal += record.quizTotal;
        acc.gamesPlayed += record.gamesPlayed;
        acc.gameScore += record.gameScore;

        return acc;
      },
      {
        minutesStudied: 0,
        lessonsOpened: 0,
        linesSelected: 0,
        aiInteractions: 0,
        quizAttempts: 0,
        quizScore: 0,
        quizTotal: 0,
        gamesPlayed: 0,
        gameScore: 0,
      },
    );

    return NextResponse.json({
      success: true,
      student: {
        studentKey: student.studentKey,
        email: student.email,
        name: student.name,
        classLevel: student.classLevel,
        section: student.section,
        rollNumber: student.rollNumber,
        schoolName: student.schoolName,
        guardianName: student.guardianName,
        guardianPhone: student.guardianPhone,
      },
      totals,
      dailyRecords: student.studyRecords,
      recentQuizAttempts: student.quizAttempts,
      recentGameAttempts: student.gameAttempts,
      recentChats: student.chatMessages,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Student summary failed.",
      },
      { status: 500 },
    );
  }
}
