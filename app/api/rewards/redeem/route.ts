import { NextResponse } from "next/server";
import { redeemPointsForAiCredits } from "@/lib/rewardSystem";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const studentKey = String(
      body.studentKey ?? body.studentId ?? "demo-student",
    );
    const credits = Number(body.credits ?? 1);

    const result = await redeemPointsForAiCredits({
      studentKey,
      credits,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Redeem request failed.",
      },
      { status: 500 },
    );
  }
}
