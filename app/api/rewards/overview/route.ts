import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ensureRewardCatalog } from "@/lib/scoring/rewardCatalog";
import {
  findOrCreateStudentByKey,
  getBangladeshDateKey,
} from "@/lib/studentTracking";

export const dynamic = "force-dynamic";

async function resolveStudentKey(request: Request) {
  const cookieStore = await cookies();
  const url = new URL(request.url);

  return (
    cookieStore.get("nctb_student_key")?.value.trim() ||
    url.searchParams.get("studentKey")?.trim() ||
    "demo-student"
  );
}

function parseArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function calculateStreak(completedDateKeys: string[], today: string) {
  const completed = new Set(completedDateKeys);
  let cursor = completed.has(today) ? today : previousDateKey(today);
  let streak = 0;

  while (completed.has(cursor)) {
    streak += 1;
    cursor = previousDateKey(cursor);
  }

  return streak;
}

export async function GET(request: Request) {
  try {
    const student = await findOrCreateStudentByKey(
      await resolveStudentKey(request),
    );

    await ensureRewardCatalog(prisma);

    const dateKey = getBangladeshDateKey();

    const [
      wallet,
      goalSetting,
      progress,
      catalog,
      inventory,
      transactions,
      completedDays,
    ] = await Promise.all([
      prisma.studentWallet.upsert({
        where: { studentId: student.id },
        update: {},
        create: { studentId: student.id },
      }),
      prisma.studentGoalSetting.upsert({
        where: { studentId: student.id },
        update: {},
        create: { studentId: student.id },
      }),
      prisma.dailyGoalProgress.upsert({
        where: {
          studentId_dateKey: {
            studentId: student.id,
            dateKey,
          },
        },
        update: {},
        create: {
          studentId: student.id,
          dateKey,
        },
      }),
      prisma.rewardItem.findMany({
        where: { active: true },
        orderBy: { costPoints: "asc" },
      }),
      prisma.studentReward.findMany({
        where: {
          studentId: student.id,
          quantity: { gt: 0 },
        },
        include: { rewardItem: true },
        orderBy: { acquiredAt: "desc" },
      }),
      prisma.rewardTransaction.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.dailyGoalProgress.findMany({
        where: {
          studentId: student.id,
          completedAt: { not: null },
        },
        select: { dateKey: true },
        orderBy: { dateKey: "desc" },
        take: 60,
      }),
    ]);

    return NextResponse.json({
      success: true,
      student: {
        name: student.name ?? "Student",
        avatarTheme: student.avatarTheme ?? "blue",
      },
      wallet,
      goal: {
        setting: goalSetting,
        progress: {
          ...progress,
          activityTypes: parseArray(progress.activityTypesJson),
        },
        streak: calculateStreak(
          completedDays.map((item) => item.dateKey),
          dateKey,
        ),
      },
      catalog: catalog.map((item) => ({
        ...item,
        metadata: JSON.parse(item.metadataJson ?? "{}"),
      })),
      inventory,
      transactions,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Rewards overview could not be loaded.",
      },
      { status: 500 },
    );
  }
}
