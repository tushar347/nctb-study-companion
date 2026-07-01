-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentKey" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StudentMemory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "openedLessonsJson" TEXT NOT NULL DEFAULT '[]',
    "selectedLinesJson" TEXT NOT NULL DEFAULT '[]',
    "usedToolsJson" TEXT NOT NULL DEFAULT '[]',
    "weakAreasJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentMemory_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResearchEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER,
    "eventType" TEXT NOT NULL,
    "selectedLine" TEXT,
    "toolUsed" TEXT,
    "score" INTEGER,
    "total" INTEGER,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuizAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER NOT NULL,
    "lessonTitle" TEXT,
    "score" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "wrongAnswersJson" TEXT NOT NULL DEFAULT '[]',
    "weakAreasJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuizAttempt_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "lessonNo" INTEGER,
    "selectedLine" TEXT,
    "toolUsed" TEXT,
    "question" TEXT,
    "answer" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'gemini',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatMessage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentKey_key" ON "Student"("studentKey");

-- CreateIndex
CREATE UNIQUE INDEX "StudentMemory_studentId_key" ON "StudentMemory"("studentId");

-- CreateIndex
CREATE INDEX "ResearchEvent_studentId_idx" ON "ResearchEvent"("studentId");

-- CreateIndex
CREATE INDEX "ResearchEvent_lessonNo_idx" ON "ResearchEvent"("lessonNo");

-- CreateIndex
CREATE INDEX "ResearchEvent_eventType_idx" ON "ResearchEvent"("eventType");

-- CreateIndex
CREATE INDEX "QuizAttempt_studentId_idx" ON "QuizAttempt"("studentId");

-- CreateIndex
CREATE INDEX "QuizAttempt_lessonNo_idx" ON "QuizAttempt"("lessonNo");

-- CreateIndex
CREATE INDEX "ChatMessage_studentId_idx" ON "ChatMessage"("studentId");

-- CreateIndex
CREATE INDEX "ChatMessage_lessonNo_idx" ON "ChatMessage"("lessonNo");
