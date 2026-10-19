import { NextResponse } from "next/server";

import { getSessionStudentKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";

const GOAL_OPTIONS = new Map([
  [40, 2],
  [60, 3],
  [100, 4],
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      targetPoints?: unknown;
    };

    const studentKey = await getSessionStudentKey();
    if (!studentKey) {
      return NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 },
      );
    }

    const targetPoints = Number(body.targetPoints);
    const targetActivityTypes = GOAL_OPTIONS.get(targetPoints);

    if (!targetActivityTypes) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose a daily goal of 40, 60, or 100 points.",
        },
        { status: 400 },
      );
    }

    const student = await findOrCreateStudentByKey(studentKey);

    const setting = await prisma.studentGoalSetting.upsert({
      where: { studentId: student.id },
      update: {
        targetPoints,
        targetActivityTypes,
        enabled: true,
      },
      create: {
        studentId: student.id,
        targetPoints,
        targetActivityTypes,
        timezone: "Asia/Dhaka",
        enabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      setting,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Daily goal could not be updated.",
      },
      { status: 500 },
    );
  }
}
