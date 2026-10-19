import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  getActiveSessionStudentKey,
  hashSessionToken,
} from "@/lib/sessionTokens";

export const SESSION_COOKIE_NAME = "nctb_student_key";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export async function setStudentSessionCookie(
  response: NextResponse,
  studentId: string,
) {
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  await prisma.studentSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      studentId,
      expiresAt,
    },
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}

export async function clearStudentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await prisma.studentSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }
}

export async function getSessionStudentKey(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = await prisma.studentSession.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      expiresAt: true,
      student: {
        select: { studentKey: true },
      },
    },
  });

  return getActiveSessionStudentKey(session);
}
