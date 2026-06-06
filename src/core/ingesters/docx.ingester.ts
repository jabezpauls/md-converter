import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import type { Ingester } from '../../types/index.js';

function createTurndown(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });
  service.use(gfm);

  // mammoth wraps every table cell's text in <p>, which the GFM table rule renders as
  // blank-line-separated blocks inside cells. Render such paragraphs inline instead.
  service.addRule('cellParagraph', {
    filter: (node) =>
      node.nodeName === 'P' &&
      node.parentNode !== null &&
      (node.parentNode.nodeName === 'TD' || node.parentNode.nodeName === 'TH'),
    replacement: (content) => content,
  });

  return service;
}

export class DOCXIngester implements Ingester {
  async ingest(input: Buffer): Promise<string> {
    // mammoth produces the cleanest HTML; turndown then yields high-fidelity Markdown.
    // Embedded image binaries are dropped to a src-less placeholder so output stays
    // text-focused (no base64 blobs, no LLM captioning).
    const { value: html } = await mammoth.convertToHtml(
      { buffer: input },
      { convertImage: mammoth.images.imgElement(async () => ({ src: '' })) }
    );

    const markdown = createTurndown().turndown(html);
    return markdown.trim() + '\n';
  }
}

export const docxIngester = new DOCXIngester();
