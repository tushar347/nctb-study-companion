"use client";

import { useEffect, useState, type CSSProperties } from "react";

type Screen = "home" | "library" | "reader" | "quiz" | "report";
type HelperTab = "simple" | "bangla" | "grammar";
type AuthMode = "login" | "signup";

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

type DynamicQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

type QuizHistoryItem = {
  lessonNo: number;
  lessonTitle: string;
  score: number;
  total: number;
  accuracy: number;
  attemptedAt: string;
};

export default function StudyCompanion() {
  const [screen, setScreen] = useState<Screen>("home");
  const [helperTab, setHelperTab] = useState<HelperTab>("simple");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authName, setAuthName] = useState("Demo Student");
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [student, setStudent] = useState<Student | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [ocrLessons, setOcrLessons] = useState<OcrLessonSummary[]>([]);
  const [activeLesson, setActiveLesson] = useState<OcrLesson | null>(null);
  const [lessonLines, setLessonLines] = useState<LessonLine[]>([]);
  const [selectedLine, setSelectedLine] = useState<LessonLine | null>(null);
  const [selectedHelp, setSelectedHelp] = useState<HelperOutput | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  const [dynamicQuizQuestions, setDynamicQuizQuestions] = useState<
    DynamicQuizQuestion[]
  >([]);
  const [quizGeneratedForLesson, setQuizGeneratedForLesson] = useState<
    number | null
  >(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState("");
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [quizScore, setQuizScore] = useState(0);
  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>([]);

  const [lineSelections, setLineSelections] = useState(0);
  const [viewedLessons, setViewedLessons] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [apiNote, setApiNote] = useState("Loading OCR-backed book reader...");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [studentRes, booksRes, ocrBookRes, progressRes] =
          await Promise.all([
            fetch("/api/student/demo"),
            fetch("/api/books"),
            fetch("/api/ocr-book"),
            fetch("/api/progress/demo"),
          ]);

        const studentData = await studentRes.json();
        const booksData = await booksRes.json();
        const ocrBookData = await ocrBookRes.json();
        const progressData = await progressRes.json();

        setStudent(studentData);
        setAuthName(studentData.name ?? "Demo Student");
        setBooks(booksData.books ?? []);
        setOcrLessons(ocrBookData.lessons ?? []);
        setProgress(progressData);

        await loadOcrLesson(1);

        setApiNote("OCR reader, AI helper, and dynamic quiz running");
      } catch {
        setApiNote("API loading failed. Please check npm run dev.");
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  async function loadOcrLesson(lessonNo: number) {
    try {
      const response = await fetch(`/api/ocr-book/lessons/${lessonNo}`);
      const data = await response.json();

      setActiveLesson(data.lesson);
      setLessonLines(data.lesson.lines ?? []);
      setSelectedLine(null);
      setSelectedHelp(null);
      setHelperTab("simple");
      setViewedLessons((prev) =>
        prev.includes(lessonNo) ? prev : [...prev, lessonNo]
      );

      setDynamicQuizQuestions([]);
      setQuizGeneratedForLesson(null);
      setQuizSubmitted(false);
      setQuizAnswers({});
      setQuizScore(0);
      setQuizError("");
    } catch {
      setSelectedHelp({
        simple: "Could not load this lesson.",
        bangla: "এই lesson load করা যায়নি।",
        grammar: "Lesson data is not available.",
      });
    }
  }

  async function loadOcrLineHelp(lineText: string) {
    try {
      const response = await fetch("/api/ocr-book/help", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineText,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.helper) {
        throw new Error(data.error ?? "Helper failed");
      }

      setSelectedHelp(data.helper);
    } catch {
      setSelectedHelp({
        simple: `This line means: "${lineText}". Read it slowly and focus on the main idea.`,
        bangla: `বাংলা সহায়তা: "${lineText}" — AI অনুবাদ চালু না থাকলে .env.local ফাইলে GEMINI_API_KEY যোগ করতে হবে।`,
        grammar:
          "Grammar help: Find the subject, verb, object or extra information, tense, and punctuation.",
      });
    }
  }

  async function selectLine(line: LessonLine) {
    setSelectedLine(line);
    setHelperTab("simple");
    setSelectedHelp(null);
    setLineSelections((prev) => prev + 1);
    await loadOcrLineHelp(line.text);
  }

  function handleAuthSubmit() {
    const cleanEmail = authEmail.trim();
    const cleanName = authName.trim();

    if (!cleanEmail) {
      setAuthMessage("Please enter your email address.");
      return;
    }

    if (authMode === "signup" && !cleanName) {
      setAuthMessage("Please enter your name for signup.");
      return;
    }

    setAuthName(cleanName || student?.name || "Demo Student");
    setAuthEmail(cleanEmail);
    setAuthMessage("");
    setIsLoggedIn(true);
    setScreen("home");
  }

  function logout() {
    setIsLoggedIn(false);
    setScreen("home");
    setAuthMode("login");
    setAuthMessage("");
  }

  async function generateQuizForActiveLesson() {
    if (!activeLesson) {
      setQuizError("Please open a lesson first.");
      return;
    }

    setScreen("quiz");
    setQuizLoading(true);
    setQuizError("");
    setQuizSubmitted(false);
    setQuizAnswers({});
    setQuizScore(0);

    try {
      const lessonText = activeLesson.lines.map((line) => line.text).join("\n");

      const response = await fetch("/api/ocr-book/quiz", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lessonNo: activeLesson.lessonNo,
          lessonTitle: activeLesson.lessonTitle,
          lessonText,
        }),
      });

      const data = await response.json();

      if (!response.ok || !Array.isArray(data.questions)) {
        throw new Error(data.error ?? "Quiz generation failed");
      }

      const questions = data.questions
        .slice(0, 5)
        .map((question: DynamicQuizQuestion, index: number) => {
          const options = Array.isArray(question.options)
            ? question.options.slice(0, 4).map(String)
            : [];

          const correctAnswer = String(
            question.correctAnswer ?? options[0] ?? ""
          );

          if (correctAnswer && !options.includes(correctAnswer)) {
            options[0] = correctAnswer;
          }

          return {
            id: question.id || `q${index + 1}`,
            question: String(question.question ?? `Question ${index + 1}`),
            options,
            correctAnswer,
            explanation: String(
              question.explanation ?? "This answer follows from the lesson text."
            ),
          };
        });

      if (questions.length === 0) {
        throw new Error("No quiz questions were generated.");
      }

      setDynamicQuizQuestions(questions);
      setQuizGeneratedForLesson(activeLesson.lessonNo);
    } catch (error) {
      setQuizError(
        error instanceof Error
          ? error.message
          : "Could not generate the quiz. Please try again."
      );
    } finally {
      setQuizLoading(false);
    }
  }

  function chooseQuizAnswer(questionId: string, option: string) {
    if (quizSubmitted) {
      return;
    }

    setQuizAnswers((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  }

  function submitDynamicQuiz() {
    if (!activeLesson || dynamicQuizQuestions.length === 0) {
      return;
    }

    const score = dynamicQuizQuestions.reduce((total, question) => {
      return quizAnswers[question.id] === question.correctAnswer
        ? total + 1
        : total;
    }, 0);

    const total = dynamicQuizQuestions.length;
    const accuracy = Math.round((score / total) * 100);

    setQuizScore(score);
    setQuizSubmitted(true);

    const historyItem: QuizHistoryItem = {
      lessonNo: activeLesson.lessonNo,
      lessonTitle: activeLesson.lessonTitle,
      score,
      total,
      accuracy,
      attemptedAt: new Date().toLocaleString(),
    };

    setQuizHistory((prev) => [historyItem, ...prev].slice(0, 8));
  }

  function resetQuizForLesson() {
    setDynamicQuizQuestions([]);
    setQuizGeneratedForLesson(null);
    setQuizSubmitted(false);
    setQuizAnswers({});
    setQuizScore(0);
    setQuizError("");
  }

  function getOptionStyle(
    question: DynamicQuizQuestion,
    option: string
  ): CSSProperties {
    if (!quizSubmitted) {
      return {};
    }

    const isSelected = quizAnswers[question.id] === option;
    const isCorrect = question.correctAnswer === option;

    if (isCorrect) {
      return {
        background: "#dcfce7",
        borderColor: "#22c55e",
        color: "#166534",
      };
    }

    if (isSelected && !isCorrect) {
      return {
        background: "#fee2e2",
        borderColor: "#ef4444",
        color: "#991b1b",
      };
    }

    return {
      opacity: 0.72,
    };
  }

  const latestQuiz = quizHistory[0];
  const averageAccuracy = quizHistory.length
    ? Math.round(
        quizHistory.reduce((sum, item) => sum + item.accuracy, 0) /
          quizHistory.length
      )
    : progress?.today.quizAccuracy ?? student?.quizAccuracy ?? 0;

  const currentAccuracy = latestQuiz?.accuracy ?? averageAccuracy;
  const currentSavedWords = (student?.savedWords ?? 0) + lineSelections;
  const answeredAllQuestions =
    dynamicQuizQuestions.length > 0 &&
    dynamicQuizQuestions.every((question) => quizAnswers[question.id]);
  const currentWrongQuestions = quizSubmitted
    ? dynamicQuizQuestions.filter(
        (question) => quizAnswers[question.id] !== question.correctAnswer
      )
    : [];

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

  if (!isLoggedIn) {
    return (
      <main className="app-shell">
        <section className="card hero-card" style={{ maxWidth: 560, margin: "0 auto" }}>
          <p className="eyebrow">NCTB Study Companion</p>
          <h1>{authMode === "login" ? "Student Login" : "Create Student Account"}</h1>
          <p className="muted">
            Sign in to save reading activity, quiz attempts, and progress report in this prototype.
          </p>

          <div className="tab-row" style={{ marginTop: 18 }}>
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              className={authMode === "signup" ? "active" : ""}
              onClick={() => setAuthMode("signup")}
            >
              Signup
            </button>
          </div>

          {authMode === "signup" && (
            <input
              value={authName}
              onChange={(event) => setAuthName(event.target.value)}
              placeholder="Student name"
              style={{
                width: "100%",
                marginTop: 18,
                padding: 14,
                borderRadius: 14,
                border: "1px solid #d7e0ee",
              }}
            />
          )}

          <input
            value={authEmail}
            onChange={(event) => setAuthEmail(event.target.value)}
            placeholder="Email address"
            type="email"
            style={{
              width: "100%",
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              border: "1px solid #d7e0ee",
            }}
          />

          {authMessage && (
            <div className="target-box" style={{ marginTop: 14 }}>
              {authMessage}
            </div>
          )}

          <button
            className="primary-btn"
            onClick={handleAuthSubmit}
            style={{ marginTop: 18 }}
          >
            {authMode === "login" ? "Login" : "Create Account"}
          </button>

          <p className="muted" style={{ marginTop: 14 }}>
            Demo mode: any email works. Real authentication can be connected later with a database.
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
          <p className="muted">
            {apiNote} • Signed in as {authName || student?.name}
          </p>
        </div>
        <button className="primary-btn" onClick={logout} style={{ marginLeft: "auto" }}>
          Logout
        </button>
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
            <h2>Hi, {authName || student?.name}</h2>
            <p className="muted">Ready for textbook reading and practice?</p>

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
            <p className="eyebrow">Learning Dashboard</p>
            <h2>OCR reader + AI quiz</h2>
            <ul className="check-list">
              <li>{viewedLessons.length} lesson(s) opened.</li>
              <li>{lineSelections} textbook line(s) selected.</li>
              <li>{quizHistory.length} quiz attempt(s) completed.</li>
              <li>Latest quiz score: {latestQuiz ? `${latestQuiz.score}/${latestQuiz.total}` : "Not attempted yet"}</li>
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
                  key={`${activeLesson?.lessonNo}-${line.id}`}
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
                  <button onClick={generateQuizForActiveLesson}>
                    Generate Quiz
                  </button>
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

            <button
              className="primary-btn"
              onClick={generateQuizForActiveLesson}
              style={{ marginTop: 18 }}
            >
              Generate 5 MCQs from this lesson
            </button>
          </div>
        </section>
      )}

      {screen === "quiz" && (
        <section className="card quiz-card">
          <p className="eyebrow">AI Lesson Quiz</p>
          <h2>
            Lesson {activeLesson?.lessonNo}: {activeLesson?.lessonTitle}
          </h2>
          <p className="muted">
            Generate five MCQs from the selected OCR-backed lesson. Correct answers turn green, wrong selected answers turn red, and every answer includes an explanation.
          </p>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              className="primary-btn"
              onClick={generateQuizForActiveLesson}
              disabled={quizLoading}
            >
              {quizLoading
                ? "Generating quiz..."
                : dynamicQuizQuestions.length > 0 &&
                    quizGeneratedForLesson === activeLesson?.lessonNo
                  ? "Regenerate 5 MCQs"
                  : "Generate 5 MCQs"}
            </button>

            {dynamicQuizQuestions.length > 0 && (
              <button className="primary-btn" onClick={resetQuizForLesson}>
                Clear Quiz
              </button>
            )}
          </div>

          {quizError && (
            <div className="target-box" style={{ marginTop: 18 }}>
              {quizError}
            </div>
          )}

          {!quizLoading && dynamicQuizQuestions.length === 0 && (
            <div className="helper-output" style={{ marginTop: 18 }}>
              Click Generate 5 MCQs to create a fresh quiz from the current lesson.
            </div>
          )}

          {dynamicQuizQuestions.map((question, index) => {
            const selectedAnswer = quizAnswers[question.id];
            const isCorrect = selectedAnswer === question.correctAnswer;

            return (
              <div className="question-card" key={question.id}>
                <div className="question-title">
                  Q{index + 1}. {question.question}
                </div>
                <p className="muted">Mark: 1</p>

                <div className="option-list">
                  {question.options.map((option) => (
                    <button
                      key={option}
                      className={`option ${
                        selectedAnswer === option ? "selected" : ""
                      }`}
                      style={getOptionStyle(question, option)}
                      onClick={() => chooseQuizAnswer(question.id, option)}
                      disabled={quizSubmitted}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {quizSubmitted && (
                  <div className="helper-output" style={{ marginTop: 12 }}>
                    <strong>{isCorrect ? "✅ Correct" : "❌ Incorrect"}</strong>
                    <br />
                    Your answer: {selectedAnswer ?? "No answer selected"}
                    <br />
                    Correct answer: {question.correctAnswer}
                    <br />
                    Explanation: {question.explanation}
                  </div>
                )}
              </div>
            );
          })}

          {dynamicQuizQuestions.length > 0 && !quizSubmitted && (
            <>
              <button
                className="primary-btn"
                onClick={submitDynamicQuiz}
                disabled={!answeredAllQuestions}
              >
                Submit Quiz
              </button>

              {!answeredAllQuestions && (
                <p className="muted" style={{ marginTop: 10 }}>
                  Answer all questions before submitting.
                </p>
              )}
            </>
          )}

          {quizSubmitted && (
            <div className="score-box">
              Score: {quizScore}/{dynamicQuizQuestions.length} • Accuracy:{" "}
              {Math.round((quizScore / dynamicQuizQuestions.length) * 100)}%
            </div>
          )}
        </section>
      )}

      {screen === "report" && (
        <section className="grid two-col">
          <div className="card">
            <p className="eyebrow">Progress Report</p>
            <h2>{authName || student?.name}'s study summary</h2>

            <div className="stats-grid">
              <Stat label="Lessons opened" value={`${viewedLessons.length}`} />
              <Stat label="Lines selected" value={`${lineSelections}`} />
              <Stat label="Quiz attempts" value={`${quizHistory.length}`} />
              <Stat label="Average accuracy" value={`${averageAccuracy}%`} />
            </div>

            <div className="target-box" style={{ marginTop: 18 }}>
              Current lesson: Lesson {activeLesson?.lessonNo} — {activeLesson?.lessonTitle}
            </div>

            <h2 style={{ marginTop: 24 }}>Latest quiz</h2>
            {latestQuiz ? (
              <div className="helper-output">
                Lesson {latestQuiz.lessonNo}: {latestQuiz.lessonTitle}
                <br />
                Score: {latestQuiz.score}/{latestQuiz.total} • Accuracy: {latestQuiz.accuracy}%
                <br />
                Attempted at: {latestQuiz.attemptedAt}
              </div>
            ) : (
              <p className="muted">No quiz attempt yet.</p>
            )}

            <button
              className="primary-btn"
              onClick={() => setScreen("reader")}
              style={{ marginTop: 18 }}
            >
              Continue Reading
            </button>
          </div>

          <div className="card">
            <p className="eyebrow">Learning Insight</p>
            <h2>What to improve next</h2>

            {currentWrongQuestions.length > 0 ? (
              <div className="helper-output">
                You missed {currentWrongQuestions.length} question(s) in the latest quiz. Review the related lesson lines and read the explanations under the red answers.
              </div>
            ) : latestQuiz ? (
              <div className="helper-output">
                Good work. Your latest quiz has no wrong answers. Try another lesson or regenerate a harder quiz.
              </div>
            ) : (
              <div className="helper-output">
                Start by selecting lines in the reader, then generate a quiz from the lesson.
              </div>
            )}

            <h2 style={{ marginTop: 24 }}>Recent quiz attempts</h2>
            {quizHistory.length > 0 ? (
              <div className="line-list">
                {quizHistory.map((item, index) => (
                  <div className="lesson-line" key={`${item.attemptedAt}-${index}`}>
                    Lesson {item.lessonNo}: {item.score}/{item.total} ({item.accuracy}%)
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No quiz history yet.</p>
            )}

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
          </div>
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
