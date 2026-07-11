const fs = require("fs");
const path = require("path");

const outDir = path.join(process.cwd(), "public", "ocr", "lessons_json");
fs.mkdirSync(outDir, { recursive: true });

function makeLesson({ lessonNo, title, textbookPageStart, textbookPageEnd, pdfPageStart, pdfPageEnd, lines }) {
  const cleanLines = lines
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return {
    lessonNo,
    title,
    lessonTitle: title,
    textbookPageStart,
    textbookPageEnd,
    pdfPageStart,
    pdfPageEnd,
    lines: cleanLines.map((text, index) => ({
      id: `lesson-${String(lessonNo).padStart(2, "0")}-line-${String(index + 1).padStart(3, "0")}`,
      lineNumber: index + 1,
      paragraphNo: index + 1,
      text
    })),
    aiReadyLines: cleanLines
      .filter((text) => text.length > 12)
      .map((text, index) => ({
        id: `lesson-${String(lessonNo).padStart(2, "0")}-ai-line-${String(index + 1).padStart(3, "0")}`,
        text
      })),
    rawText: cleanLines.join("\n"),
    cleanText: cleanLines.join("\n"),
    aiReadyText: cleanLines.filter((text) => text.length > 12).join("\n")
  };
}

const lessons = [
  makeLesson({
    lessonNo: 1,
    title: "Going to a New School",
    textbookPageStart: 1,
    textbookPageEnd: 3,
    pdfPageStart: 6,
    pdfPageEnd: 8,
    lines: [
      "After completing the lesson students will be able to read and understand texts.",
      "After completing the lesson students will be able to talk about people, places and familiar objects in short and simple sentences.",
      "After completing the lesson students will be able to write short paragraphs.",
      "Tarun has moved to a new city with his parents.",
      "He is going to a new school and his new teacher has given him the following form to fill out.",
      "His teacher wants to know more about him.",
      "Read the form and see what Tarun has written about himself.",
      "My name is Tarun Chowdhury.",
      "I am 11 years old.",
      "I have brown eyes, brown hair, and I am 4 feet, 3 inches tall.",
      "I am good at playing football and drawing.",
      "My hobbies are collecting stamps and reading.",
      "I like to read comic books and eat peanuts.",
      "I really do not like any kind of soft drinks.",
      "Now, write down similar information about yourself.",
      "Read the following passage about Tarun's first day at the new school.",
      "My first day at the new school was interesting.",
      "I was going to school with my father in a rickshaw.",
      "We reached school after fifteen minutes.",
      "My father said goodbye and left me at the school gate.",
      "I went in and found that everyone had gone to class.",
      "I walked into my classroom and found a seat.",
      "After some time a teacher came and warmly greeted us.",
      "I found the students very friendly in my new class.",
      "Choose the best answer.",
      "The passage is about how Tarun felt on the first day in school and why he felt so.",
      "Match a word from Column A with a word from Column B that has similar meaning.",
      "Talk about your first day at school and how you felt.",
      "Now, write a paragraph on how you felt on your first day at school and why you felt so.",
      "Read the following poem and complete this lesson with fun and laughter.",
      "School is over, Oh, what fun!",
      "Lessons finished, Play begun.",
      "Who will run fastest, You or I?",
      "Who will laugh loudest? Let us try.",
      "Notice the use of punctuation marks in the poem."
    ]
  }),
  makeLesson({
    lessonNo: 2,
    title: "Congratulations! Well Done!",
    textbookPageStart: 4,
    textbookPageEnd: 6,
    pdfPageStart: 9,
    pdfPageEnd: 11,
    lines: [
      "We often use some routine expressions in our everyday conversations.",
      "Read the following conversations and see some of the different ways in which we can respond to good or bad news.",
      "Lily goes to a school in Dhaka and her parents live in a small town in Tangail district.",
      "Lily is talking to her father over telephone.",
      "Lily says, Hello, Baba!",
      "Baba asks, Lily? How are you?",
      "Lily says, Fine, Baba. I just got my exam result. I have got an A in my English test.",
      "Baba says, Well done, daughter! I am so proud of you.",
      "Rahul is a good singer.",
      "His new album has just come out.",
      "Nina says, Oh, great! Congratulations!",
      "When we are glad or happy to hear about any good news, we usually express our happiness with expressions like Congratulations, Well done, That's marvelous, That's wonderful, and Great.",
      "When we hear about bad news, we say, I am sorry to hear that or That is bad luck."
    ]
  }),
  makeLesson({
    lessonNo: 3,
    title: "At a Railway Station",
    textbookPageStart: 7,
    textbookPageEnd: 8,
    pdfPageStart: 12,
    pdfPageEnd: 13,
    lines: [
      "Read the following passage.",
      "My friend Sajjad and I were sitting at the railway station.",
      "I came to see him off.",
      "Sajjad was going to Dhaka to his elder sister's house.",
      "It was very crowded in the station.",
      "There was a long line of people at the ticket counter.",
      "A woman was standing in the queue.",
      "She was holding her child's hand tightly.",
      "A group of young people was talking loudly and drinking tea in front of a tea stall.",
      "An old couple was trying to find a quiet place to sit down and rest.",
      "The waiting room was crowded, too.",
      "Soon my friend's train started to leave.",
      "As the train whistled, he picked up his suitcase and we said goodbye to each other."
    ]
  }),
  makeLesson({
    lessonNo: 4,
    title: "Where are You From?",
    textbookPageStart: 9,
    textbookPageEnd: 12,
    pdfPageStart: 14,
    pdfPageEnd: 17,
    lines: [
      "It is natural that when two persons meet they would engage in a conversation.",
      "They may want to know where the other comes from, or what the other person does and so on.",
      "Here are some conversations in such everyday situations.",
      "Mamun and his friend Akash have gone to a book fair.",
      "Mamun introduces Akash to someone.",
      "Akash says, Hello! My name is Akash. I am sorry, I could not catch your name.",
      "The stranger says, James. James Collins. Nice to meet you.",
      "Akash says, Nice to meet you, too. Where are you from, James?",
      "James says, I am from England.",
      "Officer asks, Where do you come from, Mr. Smith?",
      "Passenger says, Australia.",
      "Officer asks, And where are you coming from now?",
      "Passenger says, I am coming from London.",
      "What do you do means the same as What is your profession?",
      "What are you doing refers to what you are doing at the moment or around that time."
    ]
  })
];

for (const lesson of lessons) {
  const fileName = `lesson-${String(lesson.lessonNo).padStart(2, "0")}.json`;
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(lesson, null, 2), "utf8");
  console.log(`Created ${fileName}`);
}

console.log("DONE: Missing Lesson 1-4 OCR JSON files created.");
