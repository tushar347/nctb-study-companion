import { repairMojibake } from "./lib/fixMojibake";

const fixture = "এখানে: ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢";
const repaired = repairMojibake(fixture);
if (!repaired.includes("•") || repaired.includes("ÃƒÆ'")) {
  throw new Error(`Mojibake fixture was not repaired: ${repaired}`);
}

console.log("Mojibake fixture passed");
