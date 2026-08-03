import { NextResponse } from "next/server";

import {
  getLocalAiConfig,
  listInstalledModels,
} from "@/lib/local-ai/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL) {
    return NextResponse.json({
      success: true,
      online: false,
      modelInstalled: false,
      preview: true,
      message:
        "Use the computer edition to study without internet.",
    });
  }

  const config =
    getLocalAiConfig();

  try {
    const models =
      await listInstalledModels();

    const modelInstalled =
      models.includes(
        config.model,
      );

    return NextResponse.json({
      success: true,
      online: true,
      modelInstalled,
      preview: false,
      message: modelInstalled
        ? "Offline Study is ready."
        : "Offline Study needs setup on this computer.",
    });
  } catch {
    return NextResponse.json({
      success: true,
      online: false,
      modelInstalled: false,
      preview: false,
      message:
        "Start Offline Study on this computer.",
    });
  }
}
