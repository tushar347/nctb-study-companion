import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  getActiveSessionStudentKey,
  hashSessionToken,
} from "../lib/sessionTokens";

test("session tokens are random URL-safe bearer values", () => {
  const first = createSessionToken();
  const second = createSessionToken();

  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
});

test("session tokens are stored as stable one-way hashes", () => {
  const token = createSessionToken();
  const hash = hashSessionToken(token);

  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashSessionToken(token), hash);
  assert.notEqual(hashSessionToken(`${token}x`), hash);
});

test("only non-expired persisted sessions resolve a student identity", () => {
  const now = Date.UTC(2026, 9, 19);
  const activeSession = {
    expiresAt: new Date(now + 1),
    student: { studentKey: "student-123" },
  };
  const expiredSession = {
    expiresAt: new Date(now),
    student: { studentKey: "student-123" },
  };

  assert.equal(getActiveSessionStudentKey(activeSession, now), "student-123");
  assert.equal(getActiveSessionStudentKey(expiredSession, now), null);
  assert.equal(getActiveSessionStudentKey(null, now), null);
});
