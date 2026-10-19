CREATE TABLE "StudentSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentSession_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StudentSession_tokenHash_key" ON "StudentSession"("tokenHash");
CREATE INDEX "StudentSession_studentId_idx" ON "StudentSession"("studentId");
CREATE INDEX "StudentSession_expiresAt_idx" ON "StudentSession"("expiresAt");
