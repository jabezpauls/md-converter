import { describe, it, expect } from 'vitest';
import { MarkdownParser } from '../parser/index.js';
import {
  getTransformer,
  htmlTransformer,
  txtTransformer,
  docxTransformer,
  pdfTransformer,
} from './index.js';

const SAMPLE = `# Heading

A paragraph with **bold** and *italic* text.

- one
- two

| a | b |
| --- | --- |
| 1 | 2 |
`;

function mdast() {
  return new MarkdownParser().parse(SAMPLE).mdast;
}

describe('getTransformer', () => {
  it('returns the matching transformer per format', () => {
    // Arrange / Act / Assert
    expect(getTransformer('html')).toBe(htmlTransformer);
    expect(getTransformer('txt')).toBe(txtTransformer);
    expect(getTransformer('docx')).toBe(docxTransformer);
    expect(getTransformer('pdf')).toBe(pdfTransformer);
  });

  it('throws on an unknown format', () => {
    // Arrange / Act / Assert
    expect(() => getTransformer('xml' as never)).toThrow(/Unsupported format/);
  });
});

describe('HTMLTransformer', () => {
  it('produces a full HTML document with the heading text', async () => {
    // Arrange / Act
    const html = (await htmlTransformer.transform(mdast())).toString('utf-8');

    // Assert
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Heading');
    expect(html).toContain('<table>');
  });
});

describe('TXTTransformer', () => {
  it('extracts plain text preserving structure', async () => {
    // Arrange / Act
    const txt = (await txtTransformer.transform(mdast())).toString('utf-8');

    // Assert
    expect(txt).toContain('Heading');
    expect(txt).toContain('one');
    expect(txt).toContain('two');
  });
});

describe('DOCXTransformer', () => {
  it('produces a non-empty docx (zip) buffer', async () => {
    // Arrange / Act
    const buf = await docxTransformer.transform(mdast());

    // Assert: .docx is a zip, which starts with the "PK" signature
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 2).toString('utf-8')).toBe('PK');
  });
});

describe('PDFTransformer', () => {
  it('produces a non-empty pdf buffer', async () => {
    // Arrange / Act
    const buf = await pdfTransformer.transform(mdast());

    // Assert: PDFs start with "%PDF"
    expect(buf.subarray(0, 4).toString('utf-8')).toBe('%PDF');
    await pdfTransformer.dispose();
  });
});
