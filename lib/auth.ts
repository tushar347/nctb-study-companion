import { cookies } from "next/headers";

export const SESSION_COOKIE_NAME = "nctb_student_key";
export const DEMO_STUDENT_KEY = "demo-student";

/**
 * The ONLY trusted source of "which student is making this request".
 *
 * Every protected page (/home, /reader, /teacher, /quiz, /games, /progress)
 * is already gated by middleware.ts, which redirects to "/" unless this
 * cookie is present. So any request coming from those pages is guaranteed
 * to have a real session cookie set by /api/auth/login or /api/auth/signup.
 *
 * Route handlers must use this instead of reading `studentKey` /
 * `studentId` out of the request body or query string. Trusting a
 * client-supplied key lets any visitor read or spend another student's
 * data (wallet, quiz history, chat log, AI credits) just by knowing or
 * guessing their key. If no session cookie is present, the caller is
 * treated as the shared, low-privilege demo account rather than whatever
 * identity they claim to be.
 */
export async function getSessionStudentKey(): Promise<string> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value || DEMO_STUDENT_KEY;
}
