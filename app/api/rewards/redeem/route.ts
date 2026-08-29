import { NextResponse } from "next/server";
import { redeemPointsForAiCredits } from "@/lib/rewardSystem";
import { getSessionStudentKey } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Never trust a studentKey from the request body here — this endpoint
    // moves points and AI credits, so the account acted on must come from
    // the session cookie, not from whatever the caller claims.
    const studentKey = await getSessionStudentKey();
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
