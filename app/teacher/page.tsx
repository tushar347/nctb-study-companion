"use client";

import { useEffect, useState } from "react";
import { Bot, Brain, Languages, Send, Sparkles, UserRound } from "lucide-react";
import AppShell from "@/components/study/AppShell";
import AiTeacherAvatar from "@/components/study/AiTeacherAvatar";
import LiquidCard from "@/components/study/LiquidCard";

type AgentTool = "simple" | "bangla" | "grammar" | "chat";

type Message = {
  role: "teacher" | "student";
  text: string;
};

export default function TeacherPage() {
  const [studentId, setStudentId] = useState("demo-student");
  const [selectedLine, setSelectedLine] = useState("");
  const [lessonNo, setLessonNo] = useState(1);
  const [lessonTitle, setLessonTitle] = useState("");
  const [output, setOutput] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "teacher",
      text: "Hello. I am your AI Teacher. Select a line from the Reader, then I can explain it, translate it, teach grammar, or answer your question.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSelectedLine(localStorage.getItem("selectedLine") ?? "");
    setLessonNo(Number(localStorage.getItem("selectedLessonNo") ?? 1));
    setLessonTitle(localStorage.getItem("selectedLessonTitle") ?? "");
  }, []);

  async function callTeacher(tool: AgentTool, studentQuestion?: string) {
    if (!selectedLine.trim()) {
      setError("Please select a textbook line from the Reader first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/agent/learning-loop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentId,
          lessonNo,
          selectedLine,
          requestedTool: tool,
          studentQuestion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "AI Teacher request failed.");
      }

      setOutput(data.result.output);

      if (tool === "chat") {
        setMessages((previous) => [
          ...previous,
          { role: "student", text: studentQuestion ?? "" },
          { role: "teacher", text: data.result.output },
        ]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Teacher failed.");
    } finally {
      setLoading(false);
    }
  }

  function sendQuestion() {
    const clean = question.trim();

    if (!clean) return;

    setQuestion("");
    callTeacher("chat", clean);
  }

  return (
    <AppShell>
      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <LiquidCard className="p-6">
          <AiTeacherAvatar />

          <div className="mt-6 rounded-3xl border border-white/80 bg-white/65 p-5 shadow-inner">
            <div className="flex items-center gap-2">
              <UserRound size={18} className="text-slate-600" />
              <p className="text-xs font-black uppercase text-slate-500">
                Student ID
              </p>
            </div>

            <input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm font-bold outline-none focus:border-blue-500"
            />
          </div>

          <div className="mt-5 rounded-3xl border border-white/80 bg-white/65 p-5 shadow-inner">
            <p className="text-xs font-black uppercase text-blue-700">
              Selected Line
            </p>
            <p className="mt-2 text-sm font-semibold leading-7">
              {selectedLine ||
                "No line selected yet. Go to Reader and select a line."}
            </p>
            {lessonTitle && (
              <p className="mt-3 text-xs font-bold text-slate-500">
                Lesson {lessonNo}: {lessonTitle}
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-3xl bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 grid grid-cols-3 gap-3">
            <button
              onClick={() => callTeacher("simple")}
              disabled={loading}
              className="rounded-3xl bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-xl disabled:opacity-60"
            >
              <Sparkles size={18} className="mx-auto mb-1" />
              Simple
            </button>

            <button
              onClick={() => callTeacher("bangla")}
              disabled={loading}
              className="rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-xl disabled:opacity-60"
            >
              <Languages size={18} className="mx-auto mb-1" />
              Bangla
            </button>

            <button
              onClick={() => callTeacher("grammar")}
              disabled={loading}
              className="rounded-3xl bg-purple-700 px-4 py-3 text-sm font-black text-white shadow-xl disabled:opacity-60"
            >
              <Brain size={18} className="mx-auto mb-1" />
              Grammar
            </button>
          </div>

          <div className="mt-5 rounded-3xl bg-white/75 p-5 shadow-inner">
            <p className="text-xs font-black uppercase text-blue-700">
              Teacher Response
            </p>
            <div className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-800">
              {loading
                ? "AI Teacher is preparing your answer..."
                : output || "Choose a help option above."}
            </div>
          </div>
        </LiquidCard>

        <LiquidCard className="p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg">
              <Bot size={28} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-purple-700">
                Personal Chat
              </p>
              <h2 className="text-2xl font-black">Ask AI Teacher</h2>
              <p className="text-sm font-semibold text-slate-500">
                Ask anything about the selected line.
              </p>
            </div>
          </div>

          <div className="mt-5 max-h-[470px] space-y-3 overflow-y-auto rounded-3xl bg-slate-50/80 p-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === "student" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[84%] rounded-3xl px-4 py-3 text-sm font-semibold leading-6 shadow-md ${
                    message.role === "student"
                      ? "bg-blue-600 text-white"
                      : "bg-white/85 text-slate-800"
                  }`}
                >
                  <p className="mb-1 text-xs font-black uppercase">
                    {message.role === "student" ? "Student" : "AI Teacher"}
                  </p>
                  {message.text}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") sendQuestion();
              }}
              placeholder="Ask your AI Teacher..."
              className="flex-1 rounded-3xl border border-white/80 bg-white/75 px-5 py-4 text-sm font-semibold outline-none transition focus:border-purple-500"
            />

            <button
              onClick={sendQuestion}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-3xl bg-gradient-to-r from-purple-700 to-blue-700 px-6 py-4 text-sm font-black text-white shadow-lg disabled:opacity-60"
            >
              <Send size={16} />
              Send
            </button>
          </div>
        </LiquidCard>
      </div>
    </AppShell>
  );
}
