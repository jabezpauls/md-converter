import { readFile, writeFile } from 'fs/promises';
import { extname } from 'path';
import { MarkdownParser } from './parser/index.js';
import { getTransformer } from './transformers/index.js';
import { getIngester } from './ingesters/index.js';
import type { ConvertOptions, OutputFormat, SourceFormat } from '../types/index.js';

const SOURCE_EXTENSIONS: Record<string, SourceFormat> = {
  '.docx': 'docx',
  '.pdf': 'pdf',
};

export class Converter {
  private parser: MarkdownParser;

  constructor() {
    this.parser = new MarkdownParser();
  }

  async convert(input: string | Buffer, options: ConvertOptions): Promise<Buffer> {
    const markdown = typeof input === 'string' ? input : input.toString('utf-8');
    const { format, syntaxHighlight = true, pageSize = 'A4' } = options;

    // Parse markdown to MDAST
    const { mdast } = this.parser.parse(markdown);

    // Get appropriate transformer
    const transformer = getTransformer(format);

    // Transform to output format
    return transformer.transform(mdast, {
      syntaxHighlight,
      pageSize,
    });
  }

  async convertToMarkdown(input: Buffer, sourceFormat: SourceFormat): Promise<string> {
    return getIngester(sourceFormat).ingest(input);
  }

  async convertFile(
    inputPath: string,
    outputPath: string,
    options: ConvertOptions
  ): Promise<void> {
    const input = await readFile(inputPath);

    if (options.format === 'md') {
      const sourceFormat = SOURCE_EXTENSIONS[extname(inputPath).toLowerCase()];
      if (!sourceFormat) {
        throw new Error(
          `Cannot convert to Markdown from "${extname(inputPath)}". Supported source formats: ${Object.keys(SOURCE_EXTENSIONS).join(', ')}`
        );
      }
      const markdown = await this.convertToMarkdown(input, sourceFormat);
      await writeFile(outputPath, markdown);
      return;
    }

    const output = await this.convert(input, options);
    await writeFile(outputPath, output);
  }
}

export const converter = new Converter();

// Convenience function for one-off conversions
export async function convert(
  markdown: string,
  format: OutputFormat,
  options: Partial<ConvertOptions> = {}
): Promise<Buffer> {
  return converter.convert(markdown, { format, ...options });
}
