"use client";

import { lesson, lessonLines, quizQuestions, student, type LessonLine } from "@/data/lesson1";
import { useMemo, useState } from "react";

type Screen = "home" | "library" | "reader" | "quiz" | "report";
type HelperTab = "simple" | "bangla" | "grammar";

export default function StudyCompanion() {
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedLine, setSelectedLine] = useState<LessonLine | null>(lessonLines[2]);
  const [helperTab, setHelperTab] = useState<HelperTab>("simple");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const score = useMemo(() => {
    return quizQuestions.reduce((total, question) => {
      return answers[question.id] === question.answer ? total + question.mark : total;
    }, 0);
  }, [answers]);

  const totalMarks = quizQuestions.reduce((total, question) => total + question.mark, 0);
  const updatedAccuracy = quizSubmitted ? Math.round((score / totalMarks) * 100) : student.quizAccuracy;
  const updatedSavedWords = selectedLine ? student.savedWords + 1 : student.savedWords;

  function selectLine(line: LessonLine) {
    setSelectedLine(line);
    setHelperTab("simple");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">N</div>
        <div>
          <p className="eyebrow">NCTB Study Companion</p>
          <h1>Class 6 English for Today</h1>
        </div>
      </header>

      <nav className="bottom-nav desktop-nav" aria-label="Main navigation">
        <button className={screen === "home" ? "active" : ""} onClick={() => setScreen("home")}>Home</button>
        <button className={screen === "library" ? "active" : ""} onClick={() => setScreen("library")}>Book</button>
        <button className={screen === "reader" ? "active" : ""} onClick={() => setScreen("reader")}>Reader</button>
        <button className={screen === "quiz" ? "active" : ""} onClick={() => setScreen("quiz")}>Quiz</button>
        <button className={screen === "report" ? "active" : ""} onClick={() => setScreen("report")}>Report</button>
      </nav>

      {screen === "home" && (
        <section className="grid two-col">
          <div className="card hero-card">
            <p className="eyebrow">Hi, {student.name}</p>
            <h2>Ready for 10 minutes of study?</h2>
            <button className="primary-btn" onClick={() => setScreen("reader")}>Continue Reading</button>
            <div className="stats-grid">
              <Stat label="Saved words" value={updatedSavedWords.toString()} />
              <Stat label="Quiz score" value={`${updatedAccuracy}%`} />
            </div>
            <div className="target-box">Today&apos;s target: Read 1 lesson + complete 1 quiz</div>
          </div>
          <div className="card">
            <h2>Week 1 focus</h2>
            <ul className="check-list">
              <li>Lock MVP scope to Class 6 EFT Lesson 1.</li>
              <li>Build clickable home, library, reader, quiz, and report screens.</li>
              <li>Use mock data first; connect backend later.</li>
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
              <button key={classNumber} className={classNumber === 6 ? "class-pill active" : "class-pill"}>{classNumber}</button>
            ))}
          </div>
          <div className="book-grid">
            <BookCard title="EFT" subtitle="English for Today" status="Lesson 1 ready" active onOpen={() => setScreen("reader")} />
            <BookCard title="BN" subtitle="Bangla" status="Coming soon" />
            <BookCard title="Math" subtitle="Mathematics" status="Coming later" />
            <BookCard title="Sci" subtitle="Science" status="Coming later" />
          </div>
        </section>
      )}

      {screen === "reader" && (
        <section className="reader-layout">
          <div className="card lesson-card">
            <p className="eyebrow">{lesson.subject}</p>
            <h2>{lesson.title}</h2>
            <p className="muted">Tap/click a line to get help.</p>
            <div className="line-list">
              {lessonLines.map((line) => (
                <button
                  key={line.id}
                  className={selectedLine?.id === line.id ? "lesson-line selected" : "lesson-line"}
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
                  <button onClick={() => setHelperTab("simple")}>Explain</button>
                  <button onClick={() => setHelperTab("bangla")}>Translate</button>
                  <button onClick={() => setHelperTab("grammar")}>Grammar</button>
                  <button onClick={() => setScreen("quiz")}>Quiz</button>
                </div>
              </div>
            )}
          </div>

          <aside className="card helper-card">
            <p className="eyebrow">Side Help Tab</p>
            <h2>Line helper</h2>
            <div className="tab-row">
              <button className={helperTab === "simple" ? "active" : ""} onClick={() => setHelperTab("simple")}>Simple</button>
              <button className={helperTab === "bangla" ? "active" : ""} onClick={() => setHelperTab("bangla")}>Bangla</button>
              <button className={helperTab === "grammar" ? "active" : ""} onClick={() => setHelperTab("grammar")}>Grammar</button>
            </div>
            <div className="helper-output">
              <p>{selectedLine?.helper[helperTab]}</p>
            </div>
          </aside>
        </section>
      )}

      {screen === "quiz" && (
        <section className="card quiz-card">
          <p className="eyebrow">Lesson 1 Quiz</p>
          <h2>NCTB-style short practice</h2>
          {quizQuestions.map((question, index) => (
            <div className="question-card" key={question.id}>
              <p className="question-title">Q{index + 1}. {question.question}</p>
              <p className="muted">Type: {question.type} • Mark: {question.mark}</p>
              <div className="option-list">
                {question.options?.map((option) => (
                  <button
                    key={option}
                    className={answers[question.id] === option ? "option selected" : "option"}
                    onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button className="primary-btn" onClick={() => setQuizSubmitted(true)}>Submit Quiz</button>
          {quizSubmitted && (
            <div className="score-box">Score: {score}/{totalMarks} • Accuracy: {updatedAccuracy}%</div>
          )}
        </section>
      )}

      {screen === "report" && (
        <section className="grid two-col">
          <div className="card">
            <p className="eyebrow">Progress Report</p>
            <h2>Daily summary</h2>
            <div className="target-box">
              Today: 1 lesson read | {updatedSavedWords} words saved | Quiz: {quizSubmitted ? `${score}/${totalMarks}` : "Not submitted yet"}
            </div>
            <button className="primary-btn" onClick={() => setScreen("reader")}>Revise Lesson</button>
          </div>
          <div className="card">
            <h2>Weekly activity</h2>
            <div className="bar-chart" aria-label="Weekly activity chart">
              {[60, 38, 74, 33, 62, 88, 52].map((height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ))}
            </div>
            <p className="weak-area">Weak area: Grammar — present simple</p>
          </div>
        </section>
      )}

      <nav className="bottom-nav mobile-nav" aria-label="Mobile navigation">
        <button className={screen === "home" ? "active" : ""} onClick={() => setScreen("home")}>Home</button>
        <button className={screen === "library" ? "active" : ""} onClick={() => setScreen("library")}>Book</button>
        <button className={screen === "quiz" ? "active" : ""} onClick={() => setScreen("quiz")}>Quiz</button>
        <button className={screen === "report" ? "active" : ""} onClick={() => setScreen("report")}>Report</button>
      </nav>
    </main>
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

function BookCard({ title, subtitle, status, active, onOpen }: { title: string; subtitle: string; status: string; active?: boolean; onOpen?: () => void }) {
  return (
    <button className={active ? "book-card active" : "book-card"} onClick={onOpen} disabled={!active}>
      <strong>{title}</strong>
      <span>{subtitle}</span>
      <em>{status}</em>
    </button>
  );
}
