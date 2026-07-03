export type ResearchEvent = {
  studentId: string;
  lessonNo?: number;
  eventType:
    | "lesson_opened"
    | "line_selected"
    | "agent_tool_request"
    | "quiz_generated"
    | "quiz_submitted"
    | "grammar_question_asked"
    | "report_viewed";
  selectedLine?: string;
  toolUsed?: string;
  score?: number;
  total?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
};

const researchEvents: ResearchEvent[] = [];

export function logResearchEvent(
  event: Omit<ResearchEvent, "timestamp">,
): ResearchEvent {
  const newEvent: ResearchEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };

  researchEvents.push(newEvent);

  return newEvent;
}

export function getResearchEvents() {
  return researchEvents;
}

export function getEventsByStudent(studentId: string) {
  return researchEvents.filter((event) => event.studentId === studentId);
}

export function getEventsByLesson(lessonNo: number) {
  return researchEvents.filter((event) => event.lessonNo === lessonNo);
}
