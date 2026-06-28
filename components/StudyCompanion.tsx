"use client";

import { useEffect, useState } from "react";

type Screen = "home" | "library" | "reader" | "quiz" | "report";
type HelperTab = "simple" | "bangla" | "grammar";

type Student = {
  id: string;
  name: string;
  className: string;
  savedWords: number;
  quizAccuracy: number;
  weeklyStudyDays: number;
};

type Book = {
  id: string;
  className: string;
  subject: string;
  title: string;
  shortTitle: string;
  status: string;
  activeLessonId?: string;
  note: string;
};

type LessonLine = {
  id: string;
  paragraphNo: number;
  text: string;
};

type HelperOutput = {
  simple: string;
  bangla: string;
  grammar: string;
};

type QuizQuestion = {
  id: string;
  type: string;
  question: string;
  options?: string[];
  mark: number;
};

type QuizResult = {
  score: number;
  totalMarks: number;
  accuracy: number;
};

type ProgressData = {
  today: {
    lessonsRead: number;
    wordsSaved: number;
    quizAccuracy: number;
    target: string;
  };
  weekly: {
    day: string;
    studyMinutes: number;
  }[];
  weakArea: string;
};

type OcrLessonSummary = {
  lessonNo: number;
  lessonTitle: string;
  pageStart?: number;
  pageEnd?: number;
  totalCharacters?: number;
};

type OcrLesson = {
  lessonNo: number;
  lessonTitle: string;
  pageStart?: number;
  pageEnd?: number;
  lines: LessonLine[];
};

export default function StudyCompanion() {
  const [screen, setScreen] = useState<Screen>("home");
  const [helperTab, setHelperTab] = useState<HelperTab>("simple");

  const [student, setStudent] = useState<Student | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [ocrLessons, setOcrLessons] = useState<OcrLessonSummary[]>([]);
  const [activeLesson, setActiveLesson] = useState<OcrLesson | null>(null);
  const [lessonLines, setLessonLines] = useState<LessonLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<LessonLine | null>(null);
  const [selectedHelp, setSelectedHelp] = useState<HelperOutput | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiNote, setApiNote] = useState("Loading OCR-backed book reader...");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [studentRes, booksRes, ocrBookRes, quizRes, progressRes] =
          await Promise.all([
            fetch("/api/student/demo"),
            fetch("/api/books"),
            fetch("/api/ocr-book"),
            fetch("/api/quiz/eft-c6-l1"),
            fetch("/api/progress/demo"),
          ]);

        const studentData = await studentRes.json();
        const booksData = await booksRes.json();
        const ocrBookData = await ocrBookRes.json();
        const quizData = await quizRes.json();
        const progressData = await progressRes.json();

        setStudent(studentData);
        setBooks(booksData.books);
        setOcrLessons(ocrBookData.lessons);
        setQuizQuestions(quizData.questions);
        setProgress(progressData);

        await loadOcrLesson(1);

        setApiNote("OCR-backed textbook reader running");
      } catch {
        setApiNote("API loading failed. Please check npm run dev.");
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  async function loadOcrLesson(lessonNo: number) {
    const response = await fetch(`/api/ocr-book/lessons/${lessonNo}`);
    const data = await response.json();

    setActiveLesson(data.lesson);
    setLessonLines(data.lesson.lines);
    setSelectedLine(null);
    setSelectedHelp(null);
    setHelperTab("simple");
  }

  function buildHelperOutput(lineText: string): HelperOutput {
    return {
      simple: `This line says: "${lineText}" Read the sentence slowly and try to understand the main idea.`,
      bangla: `বাংলা সহায়তা: এই লাইনের মূল ভাব বুঝতে বাক্যটি অংশে ভাগ করে পড়ো — "${lineText}"`,
      grammar: `Grammar help: Look for the subject, verb, and object/complement in this line. Then check the tense and punctuation.`,
    };
  }

  function selectLine(line: LessonLine) {
    setSelectedLine(line);
    setHelperTab("simple");
    setSelectedHelp(buildHelperOutput(line.text));
  }

  async function submitQuiz() {
    const response = await fetch("/api/quiz/attempt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: student?.id,
        lessonId: activeLesson?.lessonNo,
        answers,
      }),
    });

    const result = await response.json();

    setQuizResult({
      score: result.score,
      totalMarks: result.totalMarks,
      accuracy: result.accuracy,
    });
  }

  const currentAccuracy =
    quizResult?.accuracy ??
    progress?.today.quizAccuracy ??
    student?.quizAccuracy ??
    0;

  const currentSavedWords =
    selectedLine && progress
      ? progress.today.wordsSaved + 1
      : (student?.savedWords ?? 0);

  if (loading) {
    return (
      <main className="app-shell">
        <section className="card">
          <p className="eyebrow">NCTB Study Companion</p>
          <h1>Loading OCR-backed book reader...</h1>
          <p className="muted">
            Please wait while the app connects to backend routes.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">N</div>
        <div>
          <p className="eyebrow">NCTB Study Companion</p>
          <h1>Class 6 English for Today</h1>
          <p className="muted">{apiNote}</p>
        </div>
      </header>

      <Nav
        screen={screen}
        setScreen={setScreen}
        className="bottom-nav desktop-nav"
      />

      {screen === "home" && (
        <section className="grid two-col">
          <div className="card hero-card">
            <p className="eyebrow">Student Home</p>
            <h2>Hi, {student?.name}</h2>
            <p className="muted">Ready for textbook reading?</p>

            <button
              className="primary-btn"
              onClick={() => setScreen("library")}
            >
              Open Book Library
            </button>

            <div className="stats-grid">
              <Stat label="Saved words" value={`${currentSavedWords}`} />
              <Stat label="Quiz accuracy" value={`${currentAccuracy}%`} />
            </div>

            <div className="target-box">
              Today's target: {progress?.today.target}
            </div>
          </div>

          <div className="card">
            <p className="eyebrow">Week 3 Reader</p>
            <h2>OCR-backed textbook text</h2>
            <ul className="check-list">
              <li>Open English for Today from Book Library.</li>
              <li>Select Lessons 1–5.</li>
              <li>Read OCR-extracted textbook lines.</li>
              <li>Click any line for helper support.</li>
              <li>Use Explain, Bangla, Grammar, Quiz, and Report.</li>
            </ul>
          </div>
        </section>
      )}

      {screen === "library" && (
        <section className="card">
          <p className="eyebrow">Book Library</p>
          <h2>Choose Class 6 → English for Today</h2>

          <div className="class-row">
            {[5, 6, 7, 8].map((classNumber) => (
              <button
                key={classNumber}
                className={`class-pill ${classNumber === 6 ? "active" : ""}`}
              >
                {classNumber}
              </button>
            ))}
          </div>

          <div className="book-grid">
            {books.map((book) => (
              <BookCard
                key={book.id}
                title={book.shortTitle}
                subtitle={book.subject}
                status={
                  book.status === "active" ? "Open OCR Book Reader" : book.note
                }
                active={book.status === "active"}
                onOpen={
                  book.status === "active"
                    ? () => setScreen("reader")
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      )}

      {screen === "reader" && (
        <section className="reader-layout">
          <div className="card">
            <p className="eyebrow">English for Today</p>
            <h2>
              Lesson {activeLesson?.lessonNo}: {activeLesson?.lessonTitle}
            </h2>
            <p className="muted">
              Select a lesson, then click any OCR-extracted line to get help.
            </p>

            <div className="class-row">
              {ocrLessons.map((lesson) => (
                <button
                  key={lesson.lessonNo}
                  className={`class-pill ${
                    activeLesson?.lessonNo === lesson.lessonNo ? "active" : ""
                  }`}
                  onClick={() => loadOcrLesson(lesson.lessonNo)}
                >
                  Lesson {lesson.lessonNo}
                </button>
              ))}
            </div>

            <div className="target-box">
              {lessonLines.length} selectable lines loaded from OCR-backed text.
            </div>

            <div className="line-list">
              {lessonLines.map((line) => (
                <button
                  key={line.id}
                  className={`lesson-line ${
                    selectedLine?.id === line.id ? "selected" : ""
                  }`}
                  onClick={() => selectLine(line)}
                >
                  {line.text}
                </button>
              ))}
            </div>

            {selectedLine && (
              <div className="popup-card">
                <p className="eyebrow">Selected line</p>
                <strong>{selectedLine.text}</strong>

                <div className="popup-actions">
                  <button onClick={() => setHelperTab("simple")}>
                    Explain
                  </button>
                  <button onClick={() => setHelperTab("bangla")}>
                    Translate
                  </button>
                  <button onClick={() => setHelperTab("grammar")}>
                    Grammar
                  </button>
                  <button onClick={() => setScreen("quiz")}>Quiz</button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <p className="eyebrow">Side Help Tab</p>
            <h2>Line helper</h2>

            <div className="tab-row">
              <button
                className={helperTab === "simple" ? "active" : ""}
                onClick={() => setHelperTab("simple")}
              >
                Simple
              </button>
              <button
                className={helperTab === "bangla" ? "active" : ""}
                onClick={() => setHelperTab("bangla")}
              >
                Bangla
              </button>
              <button
                className={helperTab === "grammar" ? "active" : ""}
                onClick={() => setHelperTab("grammar")}
              >
                Grammar
              </button>
            </div>

            <div className="helper-output">
              {selectedHelp
                ? selectedHelp[helperTab]
                : "Select a textbook line to load helper output."}
            </div>
          </div>
        </section>
      )}

      {screen === "quiz" && (
        <section className="card quiz-card">
          <p className="eyebrow">Lesson Quiz</p>
          <h2>NCTB-style short practice</h2>
          <p className="muted">
            Demo quiz is connected to the current backend quiz route.
          </p>

          {quizQuestions.map((question, index) => (
            <div className="question-card" key={question.id}>
              <div className="question-title">
                Q{index + 1}. {question.question}
              </div>
              <p className="muted">
                Type: {question.type} • Mark: {question.mark}
              </p>

              <div className="option-list">
                {question.options?.map((option) => (
                  <button
                    key={option}
                    className={`option ${
                      answers[question.id] === option ? "selected" : ""
                    }`}
                    onClick={() =>
                      setAnswers((prev) => ({
                        ...prev,
                        [question.id]: option,
                      }))
                    }
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button className="primary-btn" onClick={submitQuiz}>
            Submit Quiz
          </button>

          {quizResult && (
            <div className="score-box">
              Score: {quizResult.score}/{quizResult.totalMarks} • Accuracy:{" "}
              {quizResult.accuracy}%
            </div>
          )}
        </section>
      )}

      {screen === "report" && (
        <section className="card">
          <p className="eyebrow">Progress Report</p>
          <h2>Daily summary</h2>

          <p>
            Today: {progress?.today.lessonsRead} lesson read |{" "}
            {currentSavedWords} words saved | Quiz:{" "}
            {quizResult
              ? `${quizResult.score}/${quizResult.totalMarks}`
              : "Not submitted yet"}
          </p>

          <button className="primary-btn" onClick={() => setScreen("reader")}>
            Revise Book
          </button>

          <h2 style={{ marginTop: 24 }}>Weekly activity</h2>

          <div className="bar-chart">
            {progress?.weekly.map((item) => (
              <span
                key={item.day}
                title={`${item.day}: ${item.studyMinutes} minutes`}
                style={{ height: `${item.studyMinutes * 7}px` }}
              />
            ))}
          </div>

          <div className="weak-area">Weak area: {progress?.weakArea}</div>
        </section>
      )}

      <Nav
        screen={screen}
        setScreen={setScreen}
        className="bottom-nav mobile-nav"
      />
    </main>
  );
}

function Nav({
  screen,
  setScreen,
  className,
}: {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  className: string;
}) {
  const items: Screen[] = ["home", "library", "reader", "quiz", "report"];

  return (
    <nav className={className}>
      {items.map((item) => (
        <button
          key={item}
          className={screen === item ? "active" : ""}
          onClick={() => setScreen(item)}
        >
          {item === "library"
            ? "Book"
            : item.charAt(0).toUpperCase() + item.slice(1)}
        </button>
      ))}
    </nav>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function BookCard({
  title,
  subtitle,
  status,
  active,
  onOpen,
}: {
  title: string;
  subtitle: string;
  status: string;
  active?: boolean;
  onOpen?: () => void;
}) {
  return (
    <button
      className={`book-card ${active ? "active" : ""}`}
      onClick={onOpen}
      disabled={!active}
    >
      <strong>{title}</strong>
      <span>{subtitle}</span>
      <em>{status}</em>
    </button>
  );
}
