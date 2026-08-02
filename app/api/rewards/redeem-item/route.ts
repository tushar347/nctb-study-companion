import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ensureRewardCatalog } from "@/lib/scoring/rewardCatalog";
import { findOrCreateStudentByKey } from "@/lib/studentTracking";

async function resolveStudentKey(bodyValue: unknown) {
  const cookieStore = await cookies();

  return (
    cookieStore.get("nctb_student_key")?.value.trim() ||
    String(bodyValue ?? "").trim() ||
    "demo-student"
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      studentKey?: unknown;
      code?: unknown;
    };

    const code = String(body.code ?? "")
      .trim()
      .toUpperCase();

    if (!code) {
      return NextResponse.json(
        {
          success: false,
          error: "A reward code is required.",
        },
        { status: 400 },
      );
    }

    const student = await findOrCreateStudentByKey(
      await resolveStudentKey(body.studentKey),
    );

    await ensureRewardCatalog(prisma);

    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.rewardItem.findUnique({
        where: { code },
      });

      if (!item || !item.active) {
        throw new Error("This reward is unavailable.");
      }

      const metadata = JSON.parse(item.metadataJson ?? "{}") as {
        consumable?: boolean;
        theme?: string;
      };

      const wallet = await tx.studentWallet.upsert({
        where: { studentId: student.id },
        update: {},
        create: { studentId: student.id },
      });

      if (wallet.learningPoints < item.costPoints) {
        throw new Error(
          `You need ${item.costPoints - wallet.learningPoints} more learning point(s).`,
        );
      }

      const existing = await tx.studentReward.findUnique({
        where: {
          studentId_rewardItemId: {
            studentId: student.id,
            rewardItemId: item.id,
          },
        },
      });

      if (existing && !metadata.consumable) {
        throw new Error(
          "This permanent reward is already unlocked.",
        );
      }

      const updatedWallet = await tx.studentWallet.update({
        where: { studentId: student.id },
        data: {
          learningPoints: {
            decrement: item.costPoints,
          },
        },
      });

      const reward = await tx.studentReward.upsert({
        where: {
          studentId_rewardItemId: {
            studentId: student.id,
            rewardItemId: item.id,
          },
        },
        update: {
          quantity: { increment: 1 },
          consumedAt: null,
        },
        create: {
          studentId: student.id,
          rewardItemId: item.id,
          quantity: 1,
        },
        include: { rewardItem: true },
      });

      if (metadata.theme) {
        await tx.student.update({
          where: { id: student.id },
          data: { avatarTheme: metadata.theme },
        });
      }

      await tx.rewardTransaction.create({
        data: {
          studentId: student.id,
          type: "REDEEM_REWARD",
          pointsChange: -item.costPoints,
          creditsChange: 0,
          reason: `Redeemed ${item.name}.`,
          metadataJson: JSON.stringify({
            rewardCode: item.code,
            rewardType: item.rewardType,
          }),
          sourceType: "REWARD",
          sourceId: item.code,
          idempotencyKey: [
            "REDEEM",
            student.id,
            item.code,
            Date.now(),
          ].join(":"),
          balanceAfter: updatedWallet.learningPoints,
        },
      });

      return {
        reward,
        wallet: updatedWallet,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Reward redemption failed.",
      },
      { status: 400 },
    );
  }
}
