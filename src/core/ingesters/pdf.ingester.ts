import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type { Ingester } from '../../types/index.js';

// PDF carries no semantic structure, so extraction is heuristic: items on the same
// vertical band form a line, larger vertical gaps start a new paragraph, and pages are
// separated by a horizontal rule. Headings/tables are not recoverable from text alone.
const PARAGRAPH_GAP = 4;

function pageToMarkdown(items: TextItem[]): string {
  const lines: { y: number; text: string }[] = [];

  for (const item of items) {
    const text = item.str;
    if (!text.trim()) continue;

    const y = item.transform[5] as number;
    const last = lines[lines.length - 1];

    if (last && Math.abs(last.y - y) <= 1) {
      last.text += (item.hasEOL ? '' : '') + text;
    } else {
      lines.push({ y, text });
    }
  }

  const blocks: string[] = [];
  let current: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    current.push(lines[i].text.trim());
    const next = lines[i + 1];
    if (!next || lines[i].y - next.y > PARAGRAPH_GAP * 3) {
      blocks.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) blocks.push(current.join(' '));

  return blocks.map((b) => b.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}

export class PDFIngester implements Ingester {
  async ingest(input: Buffer): Promise<string> {
    // Loaded lazily so the heavy pdfjs runtime is only pulled in for PDF input.
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // We only extract text, never render, so silence pdfjs's canvas-polyfill warnings.
    const doc = await getDocument({
      data: new Uint8Array(input),
      verbosity: 0,
    }).promise;
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items.filter((i): i is TextItem => 'str' in i);
      pages.push(pageToMarkdown(items));
    }

    await doc.destroy();
    return pages.filter(Boolean).join('\n\n---\n\n').trim() + '\n';
  }
}

export const pdfIngester = new PDFIngester();
