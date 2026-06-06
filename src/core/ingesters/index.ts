import type { Ingester, SourceFormat } from '../../types/index.js';
import { docxIngester } from './docx.ingester.js';
import { pdfIngester } from './pdf.ingester.js';

export { DOCXIngester, docxIngester } from './docx.ingester.js';
export { PDFIngester, pdfIngester } from './pdf.ingester.js';

const ingesters: Record<SourceFormat, Ingester> = {
  docx: docxIngester,
  pdf: pdfIngester,
};

export function getIngester(format: SourceFormat): Ingester {
  const ingester = ingesters[format];
  if (!ingester) {
    throw new Error(`Unsupported source format: ${format}`);
  }
  return ingester;
}
