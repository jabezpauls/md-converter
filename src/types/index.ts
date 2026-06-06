import type { Root } from 'mdast';

export type OutputFormat = 'docx' | 'pdf' | 'txt' | 'html' | 'md';

export type SourceFormat = 'docx' | 'pdf';

export interface ConvertOptions {
  format: OutputFormat;
  syntaxHighlight?: boolean;
  pageSize?: 'A4' | 'Letter';
  template?: string;
}

export interface ParseOptions {
  gfm?: boolean;
}

export interface ParseResult {
  mdast: Root;
}

export interface TransformerOptions {
  syntaxHighlight?: boolean;
  pageSize?: 'A4' | 'Letter';
  template?: string;
}

export interface Transformer {
  transform(mdast: Root, options?: TransformerOptions): Promise<Buffer>;
}

export interface Ingester {
  ingest(input: Buffer): Promise<string>;
}

export interface FormatInfo {
  id: OutputFormat;
  name: string;
  extension: string;
  mimeType: string;
}

export const FORMAT_INFO: Record<OutputFormat, FormatInfo> = {
  docx: {
    id: 'docx',
    name: 'Microsoft Word',
    extension: '.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  pdf: {
    id: 'pdf',
    name: 'PDF Document',
    extension: '.pdf',
    mimeType: 'application/pdf',
  },
  html: {
    id: 'html',
    name: 'HTML Document',
    extension: '.html',
    mimeType: 'text/html',
  },
  txt: {
    id: 'txt',
    name: 'Plain Text',
    extension: '.txt',
    mimeType: 'text/plain',
  },
  md: {
    id: 'md',
    name: 'Markdown',
    extension: '.md',
    mimeType: 'text/markdown',
  },
};
