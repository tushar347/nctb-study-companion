export type QuizDifficulty =
  | "easy"
  | "medium"
  | "hard";

export type QuizMode =
  | "quick"
  | "model";

export type ModelQuizRequest = {
  mode: "model";
  bookId: string;
  classLevel: number;
  pageNumber: number;
  lessonNo?: number;
  lessonTitle?: string;
  selectedText?: string;
  passage?: string;
  difficulty: QuizDifficulty;
};

export type McqQuestion = {
  id: string;
  question: string;
  options: [
    string,
    string,
    string,
    string,
  ];
  correctAnswerIndex: number;
  explanation: string;
  marks: 1;
};

export type PassageQuestion = {
  id: string;
  question: string;
  expectedAnswer: string;
  keywords: string[];
  explanation: string;
  marks: 1;
};

export type FillBlankQuestion = {
  id: string;
  sentence: string;
  acceptedAnswers: string[];
  explanation: string;
  marks: 1;
};

export type FillWithCluesSection = {
  clueBox: string[];
  questions: FillBlankQuestion[];
};

export type ModelQuizPaper = {
  schemaVersion: 1;
  quizId: string;
  mode: "model";
  title: string;
  bookId: string;
  classLevel: number;
  pageNumber: number;
  lessonNo?: number;
  lessonTitle?: string;
  difficulty: QuizDifficulty;
  passage: string;
  instructions: string[];
  timeMinutes: number;
  totalMarks: 20;
  sections: {
    mcq: McqQuestion[];
    passageQuestions: PassageQuestion[];
    fillWithoutClues: FillBlankQuestion[];
    fillWithClues: FillWithCluesSection;
  };
};

export type ModelQuizSubmission = {
  quizId: string;
  studentKey: string;
  answers: {
    mcq: Record<string, number>;
    passageQuestions: Record<
      string,
      string
    >;
    fillWithoutClues: Record<
      string,
      string
    >;
    fillWithClues: Record<
      string,
      string
    >;
  };
};

export type WrongAnswer = {
  section:
    | "mcq"
    | "passageQuestions"
    | "fillWithoutClues"
    | "fillWithClues";
  questionId: string;
  submittedAnswer:
    | string
    | number
    | null;
  correctAnswer: string;
};

export type ModelQuizScore = {
  score: number;
  total: number;
  percentage: number;
  sections: {
    mcq: {
      score: number;
      total: 5;
    };
    passageQuestions: {
      score: number;
      total: 5;
    };
    fillWithoutClues: {
      score: number;
      total: 5;
    };
    fillWithClues: {
      score: number;
      total: 5;
    };
  };
  wrongAnswers: WrongAnswer[];
  weakAreas: string[];
};
