export type Class6Lesson = {
  lessonNo: number;
  title: string;
  pdfStart: number;
  pdfEnd: number;
};

export const class6Lessons: Class6Lesson[] = [
  { lessonNo: 1, title: "Going to a New School", pdfStart: 6, pdfEnd: 8 },
  { lessonNo: 2, title: "Congratulations! Well Done!", pdfStart: 9, pdfEnd: 11 },
  { lessonNo: 3, title: "At a Railway Station", pdfStart: 12, pdfEnd: 13 },
  { lessonNo: 4, title: "Where are You From?", pdfStart: 14, pdfEnd: 17 },
  { lessonNo: 5, title: "Thanks for Your Work", pdfStart: 18, pdfEnd: 21 },
  { lessonNo: 6, title: "It Smells Good!", pdfStart: 22, pdfEnd: 23 },
  { lessonNo: 7, title: "Holding Hands", pdfStart: 24, pdfEnd: 25 },
  { lessonNo: 8, title: "Grocery Shopping", pdfStart: 26, pdfEnd: 32 },
  { lessonNo: 9, title: "Health is Wealth", pdfStart: 33, pdfEnd: 37 },
  { lessonNo: 10, title: "Remedies: Modern and Traditional", pdfStart: 38, pdfEnd: 41 },
  { lessonNo: 11, title: "Are You Listening?-1", pdfStart: 42, pdfEnd: 43 },
  { lessonNo: 12, title: "An Unseen Beauty of Bangladesh", pdfStart: 44, pdfEnd: 46 },
  { lessonNo: 13, title: "Our Pride", pdfStart: 47, pdfEnd: 50 },
  { lessonNo: 14, title: "The Lion's Mane", pdfStart: 51, pdfEnd: 53 },
  { lessonNo: 15, title: "An Old People's Home", pdfStart: 54, pdfEnd: 56 },
  { lessonNo: 16, title: "Boats Sail on the Rivers", pdfStart: 57, pdfEnd: 57 },
  { lessonNo: 17, title: "Are You Listening?-2", pdfStart: 58, pdfEnd: 60 },
  { lessonNo: 18, title: "Make Your Snacks", pdfStart: 61, pdfEnd: 64 },
  { lessonNo: 19, title: "Stop, Look and Listen", pdfStart: 65, pdfEnd: 65 },
  { lessonNo: 20, title: "Hason Raja: The Mystic Bard of Bangladesh", pdfStart: 66, pdfEnd: 67 },
  { lessonNo: 21, title: "Wonders of the World-1", pdfStart: 68, pdfEnd: 69 },
  { lessonNo: 22, title: "Wonders of the World-2", pdfStart: 70, pdfEnd: 72 },
  { lessonNo: 23, title: "We Live in a Global Village", pdfStart: 73, pdfEnd: 75 },
  { lessonNo: 24, title: "Our Wage Earners", pdfStart: 76, pdfEnd: 79 },
  { lessonNo: 25, title: "The Concert for Bangladesh", pdfStart: 80, pdfEnd: 82 },
  { lessonNo: 26, title: "Buying Clothes", pdfStart: 83, pdfEnd: 87 },
  { lessonNo: 27, title: "Andre", pdfStart: 88, pdfEnd: 88 },
  { lessonNo: 28, title: "Are You Listening?-3", pdfStart: 89, pdfEnd: 90 },
  { lessonNo: 29, title: "Taking a Test", pdfStart: 91, pdfEnd: 92 },
  { lessonNo: 30, title: "What Should We do?", pdfStart: 93, pdfEnd: 94 },
  { lessonNo: 31, title: "Too Much or Too Little Water", pdfStart: 95, pdfEnd: 96 },
  { lessonNo: 32, title: "An Invitation for Robin", pdfStart: 97, pdfEnd: 98 },
  { lessonNo: 33, title: "The Garden", pdfStart: 99, pdfEnd: 105 },
];

export function getLessonForPage(
  pageNumber: number,
) {
  return (
    class6Lessons.find(
      (lesson) =>
        pageNumber >= lesson.pdfStart &&
        pageNumber <= lesson.pdfEnd,
    ) ?? null
  );
}
