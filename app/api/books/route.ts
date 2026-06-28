export async function GET() {
  return Response.json({
    books: [
      {
        id: "eft-c6",
        className: "Class 6",
        subject: "English for Today",
        title: "English for Today",
        shortTitle: "EFT",
        status: "active",
        activeLessonId: "eft-c6-l1",
        note: "Lesson 1 ready for demo",
      },
      {
        id: "bn-c6",
        className: "Class 6",
        subject: "Bangla",
        title: "Bangla",
        shortTitle: "BN",
        status: "future",
        note: "Coming soon",
      },
      {
        id: "math-c6",
        className: "Class 6",
        subject: "Mathematics",
        title: "Mathematics",
        shortTitle: "Math",
        status: "future",
        note: "Coming later",
      },
      {
        id: "science-c6",
        className: "Class 6",
        subject: "Science",
        title: "Science",
        shortTitle: "Sci",
        status: "future",
        note: "Coming later",
      },
    ],
  });
}
