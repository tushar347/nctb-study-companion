export function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => sentence.trim().length > 15);
}
