import { extractText, getDocumentProxy } from "unpdf";
import { parseQuestions } from "@/lib/questions/parse";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Takes a PDF (or pasted text) and returns structured questions.
 *
 * The file is read into memory, text is pulled out, and the file is gone
 * when the request ends. Nothing is stored until the person reviews the
 * questions and saves the set themselves.
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Send a PDF or some text." }, { status: 400 });

  const file = form.get("file");
  const pasted = form.get("text");

  let text = "";
  let sourceName: string | null = null;
  let pages = 0;

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) {
      return Response.json({ error: "That PDF is over 15 MB. Try exporting just the question pages." }, { status: 413 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
    if (!isPdf) {
      // Plain text files are fine too; anything else we can't read.
      if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
        text = new TextDecoder().decode(bytes);
      } else {
        return Response.json({ error: "Only PDFs and plain text files work right now." }, { status: 415 });
      }
    } else {
      try {
        const pdf = await getDocumentProxy(bytes);
        const out = await extractText(pdf, { mergePages: true });
        text = out.text as string;
        pages = out.totalPages;
      } catch (err) {
        console.error("pdf extract failed", err);
        return Response.json({ error: "That PDF couldn't be read. If it's a scan, try pasting the text instead." }, { status: 422 });
      }
    }
    sourceName = file.name;
  } else if (typeof pasted === "string" && pasted.trim()) {
    text = pasted;
  } else {
    return Response.json({ error: "Send a PDF or some text." }, { status: 400 });
  }

  if (text.trim().length < 20) {
    return Response.json(
      { error: pages ? "This PDF has no selectable text, so it's probably a scan. Paste the questions instead." : "There's no text to read." },
      { status: 422 },
    );
  }

  const result = parseQuestions(text);
  return Response.json({ ...result, sourceName, pages, characters: text.length });
}
