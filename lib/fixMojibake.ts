import iconv from "iconv-lite";

const MOJIBAKE_MARKERS = /[\u00c3\u00c2\u00e0\u00e2]/;
const STACKED_BULLET_MARKER = "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢";

export function repairMojibake(text: string): string {
  let repaired = text.replace(STACKED_BULLET_MARKER, "\u2022");

  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    const next = repaired.replace(/\S+/g, (segment) => {
      if (!MOJIBAKE_MARKERS.test(segment)) {
        return segment;
      }

      try {
        const candidate = iconv.decode(
          iconv.encode(segment, "win1252"),
          "utf8",
        );
        if (candidate.includes("\uFFFD") || candidate === segment) {
          return segment;
        }
        changed ||= true;
        return candidate;
      } catch {
        return segment;
      }
    });

    repaired = next;
    if (!changed) {
      break;
    }
  }

  return repaired;
}
