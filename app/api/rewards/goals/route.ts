import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";

async function resolveStudentKey(bodyValue: unknown) {
  const cookieStore = await cookies();

  return (
    cookieStore.get("nctb_student_key")?.value.trim() ||
    String(bodyValue ?? "").trim() ||
    "demo-student"
  );
}

const GOAL_OPTIONS = new Map([
  [40, 2],
  [60, 3],
  [100, 4],
]);

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      studentKey?: unknown;
      targetPoints?: unknown;
    };

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

    const student = await findOrCreateStudentByKey(
      await resolveStudentKey(body.studentKey),
    );

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
