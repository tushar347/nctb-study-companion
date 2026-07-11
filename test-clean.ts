import { cleanBookText } from "./lib/ai/textCleaner";

const text = `
1. A. Tarun has moved to a new city.
2. He is going to a new school.
`;

console.log(cleanBookText(text));
