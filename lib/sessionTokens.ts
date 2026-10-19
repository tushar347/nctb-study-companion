import { createHash, randomBytes } from "node:crypto";

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getActiveSessionStudentKey(
  session: {
    expiresAt: Date;
    student: { studentKey: string };
  } | null,
  now = Date.now(),
) {
  if (!session || session.expiresAt.getTime() <= now) {
    return null;
  }

  return session.student.studentKey;
}
