export function cleanBookText(text: string) {
  return (
    text

      // remove page numbers
      .replace(/^\s*\d+\s*$/gm, "")

      // remove numbered bullets
      .replace(/^\s*\d+[\.\)]\s*/gm, "")

      // remove alphabet bullets
      .replace(/^\s*[A-Z][\.\)]\s*/gm, "")

      // remove bullet symbols
      .replace(/^[•●▪◦]\s*/gm, "")

      // remove extra spaces
      .replace(/\s+/g, " ")

      .trim()
  );
}
