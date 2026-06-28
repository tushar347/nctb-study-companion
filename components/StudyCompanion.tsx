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

type Lesson = {
  id: string;
  className: string;
  subject: string;
  title: string;
  subtitle: string;
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

export default function StudyCompanion() {
  const [screen, setScreen] = useState<Screen>("home");
  const [helperTab, setHelperTab] = useState<HelperTab>("simple");

  const [student, setStudent] = useState<Student | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonLines, setLessonLines] = useState<LessonLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<LessonLine | null>(null);
  const [selectedHelp, setSelectedHelp] = useState<HelperOutput | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiNote, setApiNote] = useState("Loading API data...");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [studentRes, booksRes, lessonRes, quizRes, progressRes] =
          await Promise.all([
            fetch("/api/student/demo"),
            fetch("/api/books"),
            fetch("/api/lessons/eft-c6-l1"),
            fetch("/api/quiz/eft-c6-l1"),
            fetch("/api/progress/demo"),
          ]);

        const studentData = await studentRes.json();
        const booksData = await booksRes.json();
        const lessonData = await lessonRes.json();
        const quizData = await quizRes.json();
        const progressData = await progressRes.json();

        setStudent(studentData);
        setBooks(booksData.books);
        setLesson(lessonData.lesson);
        setLessonLines(lessonData.lines);
        setQuizQuestions(quizData.questions);
        setProgress(progressData);

        const defaultLine = lessonData.lines[2] ?? lessonData.lines[0];

        if (defaultLine) {
          setSelectedLine(defaultLine);
          await loadLineHelp(defaultLine.id);
        }

        setApiNote("Week 2 API connected");
      } catch {
        setApiNote("API loading failed. Please check npm run dev.");
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  async function loadLineHelp(lineId: string) {
    const response = await fetch(`/api/lines/${lineId}/help`);
    const data = await response.json();
    setSelectedHelp(data.helper);
  }

  async function selectLine(line: LessonLine) {
    setSelectedLine(line);
    setHelperTab("simple");
    setSelectedHelp(null);
    await loadLineHelp(line.id);
  }

  async function submitQuiz() {
    const response = await fetch("/api/quiz/attempt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId: student?.id,
        lessonId: lesson?.id,
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
          <h1>Loading Week 2 API data...</h1>
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
            <p className="muted">Ready for 10 minutes of study?</p>

            <button className="primary-btn" onClick={() => setScreen("reader")}>
              Continue Reading
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
            <p className="eyebrow">Week 2 Update</p>
            <h2>Frontend now loads API data</h2>
            <ul className="check-list">
              <li>Student data comes from API.</li>
              <li>Book list comes from API.</li>
              <li>Lesson lines come from API.</li>
              <li>Selected line help comes from API.</li>
              <li>Quiz result is calculated by API.</li>
            </ul>
          </div>
        </section>
      )}

      {screen === "library" && (
        <section className="card">
          <p className="eyebrow">Book Library</p>
          <h2>Choose Class 6 → English for Today → Lesson 1</h2>

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
                status={book.note}
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
            <p className="eyebrow">{lesson?.subject}</p>
            <h2>{lesson?.title}</h2>
            <p className="muted">Tap/click a line to get help.</p>

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
                : "Loading helper output..."}
            </div>
          </div>
        </section>
      )}

      {screen === "quiz" && (
        <section className="card quiz-card">
          <p className="eyebrow">Lesson 1 Quiz</p>
          <h2>NCTB-style short practice</h2>

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
                      setAnswers((prev) => ({ ...prev, [question.id]: option }))
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
            Revise Lesson
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
