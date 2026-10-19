import { NextResponse } from "next/server";
import { clearStudentSession, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  await clearStudentSession();

  const response = NextResponse.json({
    success: true,
    message: "Logged out successfully.",
  });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
