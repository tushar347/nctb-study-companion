-- CreateTable
CREATE TABLE "StudentSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER NOT NULL,
    "lessonTitle" TEXT,
    "questionsJson" TEXT NOT NULL,
    "answersJson" TEXT,
    "resultJson" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuizSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentSession_tokenHash_key" ON "StudentSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StudentSession_studentId_idx" ON "StudentSession"("studentId");

-- CreateIndex
CREATE INDEX "StudentSession_expiresAt_idx" ON "StudentSession"("expiresAt");

-- CreateIndex
CREATE INDEX "QuizSession_studentId_idx" ON "QuizSession"("studentId");

-- CreateIndex
CREATE INDEX "QuizSession_expiresAt_idx" ON "QuizSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "StudentSession" ADD CONSTRAINT "StudentSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuizSession" ADD CONSTRAINT "QuizSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
