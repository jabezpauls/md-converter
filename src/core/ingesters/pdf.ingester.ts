import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type { Ingester } from '../../types/index.js';

/**
 * PDF text has no semantic structure. Extraction is heuristic:
 * - items on the same vertical band form a line
 * - x-coordinate gaps insert missing spaces (justified / run-split text)
 * - vertical gaps relative to font height start paragraphs
 * - larger fonts become markdown headings
 * - repeated top/bottom lines across pages are treated as headers/footers
 * - short "Label: value" lines become markdown list items
 */

/** Same-line Y tolerance as a fraction of font height. */
const LINE_Y_TOLERANCE = 0.35;
/** Minimum absolute Y tolerance (PDF units). */
const LINE_Y_MIN = 1.5;
/** X-gap (as fraction of font size) that implies a space between runs. */
const SPACE_GAP_RATIO = 0.12;
/** Vertical gap (× font height) that starts a new paragraph. */
const PARAGRAPH_GAP_RATIO = 1.75;
/** Font size ratio vs body text that qualifies as a heading. */
const HEADING_SIZE_RATIO = 1.15;
/** Contact / site chrome often used in page headers and footers. */
const HEADER_FOOTER_RE =
  /(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w.-]+\.\w{2,}\b|\(\+\d{1,3}\)\s*[\d-]+|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i;
/** Section label like "Abstract:" or "Methodology:". */
const SECTION_LABEL_RE = /^[A-Z][A-Za-z0-9 /&'()-]{0,48}:$/;
/** Key-value line like "Programming Languages: HTML, CSS". */
const KEY_VALUE_RE = /^([A-Z][A-Za-z0-9 /&'()-]{1,48}):\s+(\S.*)$/;

export interface ExtractedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  hasEOL: boolean;
}

export interface ExtractedLine {
  y: number;
  x: number;
  text: string;
  fontSize: number;
  height: number;
}

export function textItemToExtracted(item: TextItem): ExtractedItem {
  const transform = item.transform;
  const fontSize = Math.abs(Number(transform[0]) || Number(item.height) || 12);
  return {
    str: item.str,
    x: Number(transform[4]) || 0,
    y: Number(transform[5]) || 0,
    width: Number(item.width) || 0,
    height: Number(item.height) || fontSize,
    fontSize,
    hasEOL: Boolean(item.hasEOL),
  };
}

/** Most common font size; on ties prefer the smaller size (body text wins over rare headings). */
function mode(values: number[]): number {
  if (!values.length) return 12;
  const counts = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v * 10) / 10;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = values[0];
  let bestCount = 0;
  for (const [size, count] of counts) {
    if (count > bestCount || (count === bestCount && size < best)) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

function needsSpace(prev: ExtractedItem, next: ExtractedItem): boolean {
  if (!prev.str || !next.str) return false;
  if (/\s$/.test(prev.str) || /^\s/.test(next.str)) return false;
  // Soft-hyphen / hard wrap: "techno-" + "logies" → no space (caller may de-hyphenate later)
  if (prev.str.endsWith('-') && /^[a-z]/.test(next.str)) return false;

  const gap = next.x - (prev.x + prev.width);
  const fontSize = Math.max(prev.fontSize, next.fontSize, 1);
  // Tiny/negative gaps are adjacent glyphs of the same word.
  if (gap <= fontSize * SPACE_GAP_RATIO) {
    // Still insert a space when both sides look like separate words jammed together
    // (common when width is 0 / missing from the PDF).
    if (gap >= -fontSize * 0.05 && /[A-Za-z0-9)]$/.test(prev.str) && /^[A-Za-z(]/.test(next.str)) {
      // Only force a space when the gap is non-trivial or width data is unusable.
      if (prev.width <= 0 || next.width <= 0 || gap > fontSize * 0.02) return true;
    }
    return false;
  }
  return true;
}

function joinLineText(items: ExtractedItem[]): string {
  // Left-to-right reading order within the band.
  const sorted = [...items].sort((a, b) => a.x - b.x || b.y - a.y);
  let text = '';
  let prev: ExtractedItem | null = null;
  for (const item of sorted) {
    if (!item.str) continue;
    if (text && prev && needsSpace(prev, item)) {
      if (!/\s$/.test(text) && !/^\s/.test(item.str)) text += ' ';
    }
    text += item.str;
    prev = item;
  }
  return text.replace(/[ \t]+/g, ' ').trim();
}

/** Group raw text items into visual lines (top → bottom). */
export function itemsToLines(items: ExtractedItem[]): ExtractedLine[] {
  const usable = items.filter((i) => i.str.trim().length > 0);
  if (!usable.length) return [];

  // Top-to-bottom, then left-to-right.
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);

  const bands: ExtractedItem[][] = [];
  for (const item of sorted) {
    const band = bands[bands.length - 1];
    if (!band) {
      bands.push([item]);
      continue;
    }
    const ref = band[0];
    const tol = Math.max(LINE_Y_MIN, Math.max(ref.fontSize, item.fontSize) * LINE_Y_TOLERANCE);
    if (Math.abs(ref.y - item.y) <= tol) {
      band.push(item);
    } else {
      bands.push([item]);
    }
  }

  return bands.map((band) => {
    const text = joinLineText(band);
    const fontSize = Math.max(...band.map((i) => i.fontSize));
    const height = Math.max(...band.map((i) => i.height || i.fontSize));
    const y = band.reduce((s, i) => s + i.y, 0) / band.length;
    const x = Math.min(...band.map((i) => i.x));
    return { y, x, text, fontSize, height };
  }).filter((l) => l.text.length > 0);
}

/** Strip URLs / emails / phones and leftover separators from a line. */
function stripInlineChrome(text: string): string {
  if (!HEADER_FOOTER_RE.test(text)) return text.trim();
  return text
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g, '')
    .replace(/\(\+\d{1,3}\)\s*[\d-]+/g, '')
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '')
    .replace(/[|/·•,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPureChrome(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (!HEADER_FOOTER_RE.test(t)) return false;
  return stripInlineChrome(t).length === 0;
}

/**
 * Drop pure header/footer chrome and lines that repeat across pages.
 * When chrome is glued onto real content (e.g. "...3085 Title:"), keep the residual text.
 */
export function stripHeadersAndFooters(pages: ExtractedLine[][]): ExtractedLine[][] {
  if (!pages.length) return pages;

  const counts = new Map<string, number>();
  for (const page of pages) {
    const seen = new Set<string>();
    for (const line of page) {
      const key = line.text.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const repeated = new Set(
    [...counts.entries()]
      .filter(([, n]) => n >= 2 && pages.length >= 2)
      .map(([k]) => k)
  );

  return pages.map((page) =>
    page
      .map((line) => {
        const raw = line.text.trim();
        if (!raw) return null;
        if (repeated.has(raw.toLowerCase()) && isPureChrome(raw)) return null;
        if (repeated.has(raw.toLowerCase()) && HEADER_FOOTER_RE.test(raw) && stripInlineChrome(raw).length === 0) {
          return null;
        }

        // Exact repeated non-chrome lines (true running headers) — drop.
        if (repeated.has(raw.toLowerCase()) && !HEADER_FOOTER_RE.test(raw)) {
          // Only drop short repeated lines (page headers), not repeated body sentences.
          if (raw.length <= 80) return null;
        }

        if (isPureChrome(raw)) return null;

        const cleaned = stripInlineChrome(raw);
        if (!cleaned) return null;
        return cleaned === raw ? line : { ...line, text: cleaned };
      })
      .filter((l): l is ExtractedLine => l !== null)
  );
}

function joinWrappedLines(parts: string[]): string {
  if (!parts.length) return '';
  let out = parts[0].trim();
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i].trim();
    if (!next) continue;
    // PDF end-of-line hyphenation: "state-of-" + "the-art" → "state-of-the-art"
    if (out.endsWith('-') && /^[a-z0-9]/.test(next)) {
      out += next;
      continue;
    }
    if (!/\s$/.test(out) && !/^\s/.test(next)) out += ' ';
    out += next;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Map font size → heading level using absolute ratios to body text.
 * Rank-among-page alone is wrong: a lone section title on page 2 would become H1.
 */
function headingLevel(fontSize: number, bodySize: number): number {
  if (fontSize < bodySize * HEADING_SIZE_RATIO) return 0;
  if (fontSize >= bodySize * 1.8) return 1;
  if (fontSize >= bodySize * 1.4) return 2;
  return 3;
}

function formatHeading(text: string, level: number): string {
  const cleaned = text.replace(/:$/, '').trim();
  const hashes = '#'.repeat(Math.max(1, Math.min(level, 6)));
  return `${hashes} ${cleaned}`;
}

function formatKeyValue(text: string): string | null {
  const m = text.match(KEY_VALUE_RE);
  if (!m) return null;
  const [, key, value] = m;
  // Avoid turning long prose sentences that happen to contain a colon into list items.
  if (key.length > 48 || value.length > 500) return null;
  if (key.split(/\s+/).length > 6) return null;
  return `- **${key}:** ${value.trim()}`;
}

/**
 * Blocks are separated by a blank line, except consecutive list items, which stay
 * adjacent so markdown renders them as one tight list rather than a loose one.
 */
function joinBlocks(blocks: string[]): string {
  let out = '';
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) {
      const bothListItems = blocks[i].startsWith('- ') && blocks[i - 1].startsWith('- ');
      out += bothListItems ? '\n' : '\n\n';
    }
    out += blocks[i];
  }
  return out.trim();
}

/**
 * Convert one page's lines into markdown blocks.
 * Exported for unit tests with synthetic geometry.
 */
export function linesToMarkdown(lines: ExtractedLine[]): string {
  if (!lines.length) return '';

  const bodySize = mode(lines.map((l) => l.fontSize));

  const blocks: string[] = [];
  let para: ExtractedLine[] = [];
  let pendingTitle = false;
  let headingBuf: { level: number; parts: string[]; fontSize: number } | null = null;

  const flushHeading = () => {
    if (!headingBuf) return;
    blocks.push(formatHeading(joinWrappedLines(headingBuf.parts), headingBuf.level));
    headingBuf = null;
  };

  const flushPara = () => {
    if (!para.length) return;
    const text = joinWrappedLines(para.map((l) => l.text));
    para = [];
    if (!text) return;

    if (pendingTitle) {
      blocks.push(formatHeading(text, 1));
      pendingTitle = false;
      return;
    }

    // Key-value lines (and their wraps) become markdown list items.
    const kv = formatKeyValue(text);
    if (kv) {
      blocks.push(kv);
      return;
    }

    blocks.push(text);
  };

  /** Start a new paragraph when the next line is clearly a new structural unit. */
  const shouldBreakBefore = (line: ExtractedLine, text: string): boolean => {
    if (SECTION_LABEL_RE.test(text) && text.length <= 40) return true;
    if (headingLevel(line.fontSize, bodySize) > 0 && text.length <= 120 && !/[,;]$/.test(text)) {
      return true;
    }
    // New key-value row should not merge with the previous one.
    if (para.length && KEY_VALUE_RE.test(text) && KEY_VALUE_RE.test(para[0].text.trim())) {
      return true;
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();
    if (!text) continue;

    // Explicit "Title:" label — following lines until a section break become H1.
    if (/^title:$/i.test(text)) {
      flushHeading();
      flushPara();
      pendingTitle = true;
      continue;
    }

    if (pendingTitle) {
      flushHeading();
      // Next section label ends the title block — emit H1 first, then the section.
      if (SECTION_LABEL_RE.test(text) && text.length <= 40) {
        flushPara(); // emits title as H1 when para has content
        pendingTitle = false;
        blocks.push(formatHeading(text, 2));
        continue;
      }
      const prev = para[para.length - 1];
      if (prev) {
        const gap = prev.y - line.y;
        const refHeight = Math.max(prev.height, line.height, prev.fontSize, line.fontSize, bodySize);
        if (gap > refHeight * PARAGRAPH_GAP_RATIO) {
          flushPara(); // emits H1 via pendingTitle
          // Fall through to normal handling for this line.
        } else {
          para.push(line);
          continue;
        }
      } else {
        para.push(line);
        continue;
      }
    }

    // Section labels: "Abstract:", "Methodology:", ...
    if (SECTION_LABEL_RE.test(text) && text.length <= 40) {
      flushHeading();
      flushPara();
      blocks.push(formatHeading(text, 2));
      continue;
    }

    const level = headingLevel(line.fontSize, bodySize);
    if (level > 0 && text.length <= 120 && !/[,;]$/.test(text)) {
      flushPara();
      // Merge wrapped heading lines of the same size into one heading.
      if (
        headingBuf &&
        headingBuf.level === level &&
        Math.abs(headingBuf.fontSize - line.fontSize) < 0.5
      ) {
        headingBuf.parts.push(text);
      } else {
        flushHeading();
        headingBuf = { level, parts: [text], fontSize: line.fontSize };
      }
      continue;
    }

    flushHeading();

    if (shouldBreakBefore(line, text)) {
      flushPara();
    }

    const prev = para[para.length - 1];
    if (!prev) {
      para.push(line);
      continue;
    }

    const gap = prev.y - line.y;
    const refHeight = Math.max(prev.height, line.height, prev.fontSize, line.fontSize, bodySize);
    // Keep wraps together; also keep key-value continuations (non-KV follow-up lines).
    if (gap > refHeight * PARAGRAPH_GAP_RATIO) {
      flushPara();
      para.push(line);
    } else {
      para.push(line);
    }
  }
  flushHeading();
  flushPara();

  return joinBlocks(blocks);
}

/** Convert raw PDF text items for a single page into markdown. */
export function pageToMarkdown(items: TextItem[]): string {
  const extracted = items.map(textItemToExtracted);
  return linesToMarkdown(itemsToLines(extracted));
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

    const pageLines: ExtractedLine[][] = [];

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items
        .filter((i): i is TextItem => 'str' in i)
        .map(textItemToExtracted);
      pageLines.push(itemsToLines(items));
    }

    await doc.destroy();

    const cleaned = stripHeadersAndFooters(pageLines);
    const pages = cleaned.map(linesToMarkdown).filter(Boolean);
    return pages.join('\n\n---\n\n').trim() + '\n';
  }
}

export const pdfIngester = new PDFIngester();
