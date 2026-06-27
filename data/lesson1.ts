export type HelperOutput = {
  simple: string;
  bangla: string;
  grammar: string;
};

export type LessonLine = {
  id: string;
  paragraphNo: number;
  text: string;
  helper: HelperOutput;
};

export type QuizQuestion = {
  id: string;
  type: "MCQ" | "Fill in the gap" | "Short answer" | "Grammar mini task";
  question: string;
  options?: string[];
  answer: string;
  mark: number;
};

export const student = {
  name: "Rafi",
  className: "Class 6",
  savedWords: 18,
  quizAccuracy: 78,
  weeklyStudyDays: 4
};

export const lesson = {
  id: "eft-c6-l1",
  className: "Class 6",
  subject: "English for Today",
  title: "Lesson 1",
  subtitle: "Sample reading passage for course demo"
};

export const lessonLines: LessonLine[] = [
  {
    id: "l1-p1-s1",
    paragraphNo: 1,
    text: "Rafi is a student of Class Six.",
    helper: {
      simple: "This line tells us who Rafi is. He studies in Class Six.",
      bangla: "রাফি ষষ্ঠ শ্রেণির একজন ছাত্র।",
      grammar: "Subject: Rafi | Verb: is | Complement: a student of Class Six | Tense: Present simple."
    }
  },
  {
    id: "l1-p1-s2",
    paragraphNo: 1,
    text: "He reads English for Today every morning.",
    helper: {
      simple: "Rafi studies his English textbook each morning.",
      bangla: "সে প্রতিদিন সকালে English for Today পড়ে।",
      grammar: "Subject: He | Verb: reads | Object: English for Today | Time: every morning | Tense: Present simple."
    }
  },
  {
    id: "l1-p1-s3",
    paragraphNo: 1,
    text: "A good friend helps us learn new things.",
    helper: {
      simple: "A good friend supports us. The friend can explain, share ideas, and make learning easier.",
      bangla: "একজন ভালো বন্ধু আমাদের নতুন জিনিস শিখতে সাহায্য করে।",
      grammar: "Subject: A good friend | Verb: helps | Object: us | Infinitive phrase: learn new things | Tense: Present simple. Note: 'helps' takes -s because the subject is singular."
    }
  },
  {
    id: "l1-p1-s4",
    paragraphNo: 1,
    text: "When he does not understand a line, he asks for help.",
    helper: {
      simple: "If Rafi finds a line difficult, he asks someone to explain it.",
      bangla: "যখন সে কোনো লাইন বুঝতে পারে না, তখন সে সাহায্য চায়।",
      grammar: "Clause 1: When he does not understand a line | Clause 2: he asks for help | Tense: Present simple negative and affirmative."
    }
  },
  {
    id: "l1-p1-s5",
    paragraphNo: 1,
    text: "Then the app explains it in easy words.",
    helper: {
      simple: "After Rafi selects the line, the app gives a simple explanation.",
      bangla: "তারপর অ্যাপটি সহজ শব্দে সেটি ব্যাখ্যা করে।",
      grammar: "Subject: the app | Verb: explains | Object: it | Adverb phrase: in easy words | Tense: Present simple."
    }
  }
];

export const quizQuestions: QuizQuestion[] = [
  {
    id: "q1",
    type: "MCQ",
    question: "What does a good friend do?",
    options: ["Helps us learn", "Stops us reading", "Makes noise", "Ignores us"],
    answer: "Helps us learn",
    mark: 1
  },
  {
    id: "q2",
    type: "Fill in the gap",
    question: "A good friend ______ us learn new things.",
    options: ["help", "helps", "helped", "helping"],
    answer: "helps",
    mark: 1
  },
  {
    id: "q3",
    type: "Grammar mini task",
    question: "Identify the verb in: 'A good friend helps us learn new things.'",
    options: ["friend", "helps", "new", "things"],
    answer: "helps",
    mark: 1
  },
  {
    id: "q4",
    type: "MCQ",
    question: "What does Rafi do every morning?",
    options: ["Reads English for Today", "Plays football", "Watches TV", "Sleeps late"],
    answer: "Reads English for Today",
    mark: 1
  }
];
