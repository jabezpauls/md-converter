import type { Transformer, OutputFormat } from '../../types/index.js';
import { htmlTransformer } from './html.transformer.js';
import { txtTransformer } from './txt.transformer.js';
import { docxTransformer } from './docx.transformer.js';
import { pdfTransformer } from './pdf.transformer.js';

export { HTMLTransformer, htmlTransformer } from './html.transformer.js';
export { TXTTransformer, txtTransformer } from './txt.transformer.js';
export { DOCXTransformer, docxTransformer } from './docx.transformer.js';
export { PDFTransformer, pdfTransformer } from './pdf.transformer.js';

// 'md' is produced by ingesters, not transformers, so it is excluded here.
type TransformFormat = Exclude<OutputFormat, 'md'>;

const transformers: Record<TransformFormat, Transformer> = {
  html: htmlTransformer,
  txt: txtTransformer,
  docx: docxTransformer,
  pdf: pdfTransformer,
};

export function getTransformer(format: OutputFormat): Transformer {
  const transformer = transformers[format as TransformFormat];
  if (!transformer) {
    throw new Error(`Unsupported format: ${format}`);
  }
  return transformer;
}
