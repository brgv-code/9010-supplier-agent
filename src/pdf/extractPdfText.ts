import { extractText, getDocumentProxy } from "unpdf";

// PDF text extraction (the deterministic half of PDF ingest). Turning that text into
// structured positions is a separate model-driven step (an LLM), because a PDF bill of
// quantities is unstructured, unlike GAEB XML which the rule parser handles directly.
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}
