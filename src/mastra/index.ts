import { Mastra } from "@mastra/core/mastra";
import { materialExtractor } from "../ai/materialExtractor.js";

// Registers agents for the Mastra dev playground: `pnpm playground` -> http://localhost:4111
// There you can chat with the material-extractor, test inputs, and view traces/evals.
export const mastra = new Mastra({
  agents: { materialExtractor },
});
