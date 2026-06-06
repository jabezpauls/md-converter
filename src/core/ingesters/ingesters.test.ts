import { describe, it, expect } from 'vitest';
import { readFile, writeFile, rm, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { converter } from '../converter.js';
import { docxIngester } from './docx.ingester.js';
import { pdfIngester } from './pdf.ingester.js';
import { getIngester } from './index.js';

const SAMPLE = `# Hello World

This is a **bold** paragraph with some text.

- First item
- Second item
`;

describe('getIngester', () => {
  it('returns an ingester for supported source formats', () => {
    // Arrange / Act / Assert
    expect(getIngester('docx')).toBe(docxIngester);
    expect(getIngester('pdf')).toBe(pdfIngester);
  });

  it('throws on an unsupported source format', () => {
    // Arrange / Act / Assert
    expect(() => getIngester('xlsx' as never)).toThrow(/Unsupported source format/);
  });
});

describe('DOCXIngester', () => {
  it('recovers headings, emphasis, and list text from a docx', async () => {
    // Arrange
    const docx = await converter.convert(SAMPLE, { format: 'docx' });

    // Act
    const markdown = await docxIngester.ingest(docx);

    // Assert
    expect(markdown).toContain('# Hello World');
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('First item');
    expect(markdown).toContain('Second item');
    expect(markdown.endsWith('\n')).toBe(true);
  });

  it('renders docx tables as clean single-line GFM rows', async () => {
    // Arrange
    const table = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
    const docx = await converter.convert(table, { format: 'docx' });

    // Act
    const markdown = await docxIngester.ingest(docx);

    // Assert: cells must not be split across blank lines
    expect(markdown).toMatch(/\|\s*a\s*\|\s*b\s*\|/);
    expect(markdown).not.toContain('\n\n|');
  });
});

describe('PDFIngester', () => {
  it('recovers body text from a pdf', async () => {
    // Arrange
    const pdf = await converter.convert(SAMPLE, { format: 'pdf' });

    // Act
    const markdown = await pdfIngester.ingest(pdf);

    // Assert
    expect(markdown).toContain('Hello World');
    expect(markdown).toContain('bold');
    expect(markdown).toContain('First item');
    expect(markdown.endsWith('\n')).toBe(true);
  });
});

describe('Converter reverse conversion', () => {
  it('convertToMarkdown turns a docx buffer into markdown', async () => {
    // Arrange
    const docx = await converter.convert(SAMPLE, { format: 'docx' });

    // Act
    const markdown = await converter.convertToMarkdown(docx, 'docx');

    // Assert
    expect(markdown).toContain('# Hello World');
  });

  it('convertFile writes markdown from a docx input', async () => {
    // Arrange
    const dir = await mkdtemp(join(tmpdir(), 'mdc-'));
    const docxPath = join(dir, 'in.docx');
    const mdPath = join(dir, 'out.md');
    await writeFile(docxPath, await converter.convert(SAMPLE, { format: 'docx' }));

    // Act
    await converter.convertFile(docxPath, mdPath, { format: 'md' });

    // Assert
    const out = await readFile(mdPath, 'utf-8');
    expect(out).toContain('# Hello World');
    await rm(dir, { recursive: true, force: true });
  });

  it('convertFile rejects an unsupported source extension for md output', async () => {
    // Arrange
    const dir = await mkdtemp(join(tmpdir(), 'mdc-'));
    const txtPath = join(dir, 'in.txt');
    await writeFile(txtPath, 'plain text');

    // Act / Assert
    await expect(
      converter.convertFile(txtPath, join(dir, 'out.md'), { format: 'md' })
    ).rejects.toThrow(/Cannot convert/);
    await rm(dir, { recursive: true, force: true });
  });
});
