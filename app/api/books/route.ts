import { access } from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const catalog = [
  {
    id: "class6-english",
    classLevel: 6,
    className: "Class 6",
    subject: "English",
    title: "English For Today",
    shortTitle: "EFT 6",
    pdfPath:
      "/books/class6-english-for-today.pdf",
  },
  {
    id: "class7-english",
    classLevel: 7,
    className: "Class 7",
    subject: "English",
    title: "English For Today",
    shortTitle: "EFT 7",
    pdfPath:
      "/books/class7-english-for-today.pdf",
  },
  {
    id: "class8-english",
    classLevel: 8,
    className: "Class 8",
    subject: "English",
    title: "English For Today",
    shortTitle: "EFT 8",
    pdfPath:
      "/books/class8-english-for-today.pdf",
  },
];

async function hasOcrIndex(
  bookId: string,
) {
  try {
    await access(
      path.join(
        process.cwd(),
        "public",
        "ocr",
        "books",
        bookId,
        "index.json",
      ),
    );

    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const books = await Promise.all(
    catalog.map(async (book) => {
      const ready =
        await hasOcrIndex(book.id);

      return {
        ...book,
        status: ready
          ? "active"
          : "processing",
        readerUrl:
          `/reader?book=${book.id}`,
      };
    }),
  );

  return Response.json({
    success: true,
    books,
  });
}
