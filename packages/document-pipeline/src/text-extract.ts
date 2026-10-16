import type { OcrClient, LlmUsage } from "@kanso/llm";
import { extractText, getDocumentProxy } from "unpdf";

export const MAX_PAGES = 20;
/** Below this many characters a PDF is treated as a scan and sent to OCR. */
const MIN_TEXT_LAYER_CHARS = 200;

export type TextExtraction = {
  text: string;
  pages: number;
  method: "pdf_text" | "ocr" | "none";
  usage?: LlmUsage;
};

export async function extractDocumentText(
  content: Buffer,
  mime: string,
  opts: { ocr?: OcrClient } = {},
): Promise<TextExtraction> {
  let pages = 1;
  if (mime === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(content));
    pages = pdf.numPages;
    if (pages > MAX_PAGES) {
      throw Object.assign(new Error(`Document trop long (${pages} pages, maximum ${MAX_PAGES}).`), {
        code: "too_many_pages",
      });
    }
    const { text } = await extractText(pdf, { mergePages: true });
    const clean = text.replace(/[ \t]+/g, " ").trim();
    if (clean.length >= MIN_TEXT_LAYER_CHARS || !opts.ocr) {
      return { text: clean, pages, method: clean ? "pdf_text" : "none" };
    }
  }
  if (!opts.ocr) return { text: "", pages, method: "none" };
  const result = await opts.ocr.ocr(content, mime);
  return { text: result.text.trim(), pages: result.pages || pages, method: "ocr", usage: result.usage };
}
