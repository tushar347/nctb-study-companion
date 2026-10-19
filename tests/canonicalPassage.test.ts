import assert from "node:assert/strict";
import test from "node:test";
import { loadCanonicalPassage } from "../lib/local-ai/canonicalPassage";
import { resolveStudySource } from "../lib/local-ai/resolveStudySource";
import { LocalAiError } from "../lib/local-ai/ollama";

test("retrieves clean text and class metadata from an allowed OCR page", async () => {
  const passage = await loadCanonicalPassage("class6-english", 12);

  assert.equal(passage.bookId, "class6-english");
  assert.equal(passage.pageNumber, 12);
  assert.equal(passage.classLevel, 6);
  assert.ok(passage.text.length >= 20);
});

test("rejects unsupported book identifiers and invalid page numbers", async () => {
  await assert.rejects(
    loadCanonicalPassage("../../.env", 1),
    LocalAiError,
  );
  await assert.rejects(
    loadCanonicalPassage("class6-english", 0),
    LocalAiError,
  );
});

test("returns not found for an unavailable canonical page", async () => {
  await assert.rejects(
    loadCanonicalPassage("class6-english", 999_999),
    (error: unknown) =>
      error instanceof LocalAiError && error.status === 404,
  );
});

test("accepts only selected text found in canonical lesson content", async () => {
  const source = await resolveStudySource({
    bookId: "class6-english",
    pageNumber: 12,
    lessonNo: 3,
    selectedText: "read and understand texts",
  });

  assert.equal(source.lessonNo, 3);
  assert.equal(source.selectedText, "read and understand texts");

  const lessonSource = await resolveStudySource({
    lessonNo: 3,
    selectedText: "read and understand texts",
  });
  assert.equal(lessonSource.pageNumber, 12);

  await assert.rejects(
    resolveStudySource({
      bookId: "class6-english",
      pageNumber: 12,
      selectedText: "A passage invented by the client.",
    }),
    LocalAiError,
  );
});
