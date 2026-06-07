import { Root } from 'mdast';

type OutputFormat = 'docx' | 'pdf' | 'txt' | 'html' | 'md';
type SourceFormat = 'docx' | 'pdf';
interface ConvertOptions {
    format: OutputFormat;
    syntaxHighlight?: boolean;
    pageSize?: 'A4' | 'Letter';
    template?: string;
}
interface ParseOptions {
    gfm?: boolean;
}
interface ParseResult {
    mdast: Root;
}
interface TransformerOptions {
    syntaxHighlight?: boolean;
    pageSize?: 'A4' | 'Letter';
    template?: string;
}
interface Transformer {
    transform(mdast: Root, options?: TransformerOptions): Promise<Buffer>;
}
interface Ingester {
    ingest(input: Buffer): Promise<string>;
}
interface FormatInfo {
    id: OutputFormat;
    name: string;
    extension: string;
    mimeType: string;
}
declare const FORMAT_INFO: Record<OutputFormat, FormatInfo>;

declare class Converter {
    private parser;
    constructor();
    convert(input: string | Buffer, options: ConvertOptions): Promise<Buffer>;
    convertToMarkdown(input: Buffer, sourceFormat: SourceFormat): Promise<string>;
    convertFile(inputPath: string, outputPath: string, options: ConvertOptions): Promise<void>;
}
declare const converter: Converter;
declare function convert(markdown: string, format: OutputFormat, options?: Partial<ConvertOptions>): Promise<Buffer>;

declare class MarkdownParser {
    parse(markdown: string, options?: ParseOptions): ParseResult;
}

declare class HTMLTransformer implements Transformer {
    transform(mdast: Root, options?: TransformerOptions): Promise<Buffer>;
    private highlightCodeBlocks;
    private decodeHtmlEntities;
}
declare const htmlTransformer: HTMLTransformer;

declare class TXTTransformer implements Transformer {
    transform(mdast: Root, _options?: TransformerOptions): Promise<Buffer>;
    private processNode;
    private processChildren;
    private processListItem;
    private formatTable;
}
declare const txtTransformer: TXTTransformer;

declare class DOCXTransformer implements Transformer {
    transform(mdast: Root, _options?: TransformerOptions): Promise<Buffer>;
    private processNodes;
    private processNode;
    private processHeading;
    private processParagraph;
    private processCodeBlock;
    private processBlockquote;
    private processList;
    private processListItem;
    private processTable;
    private processThematicBreak;
    private processInlineContent;
    private processInlineNode;
    private extractText;
}
declare const docxTransformer: DOCXTransformer;

declare class PDFTransformer implements Transformer {
    private browser;
    private htmlTransformer;
    constructor();
    transform(mdast: Root, options?: TransformerOptions): Promise<Buffer>;
    private htmlToPdf;
    private getBrowser;
    dispose(): Promise<void>;
}
declare const pdfTransformer: PDFTransformer;

declare function getTransformer(format: OutputFormat): Transformer;

declare class DOCXIngester implements Ingester {
    ingest(input: Buffer): Promise<string>;
}
declare const docxIngester: DOCXIngester;

declare class PDFIngester implements Ingester {
    ingest(input: Buffer): Promise<string>;
}
declare const pdfIngester: PDFIngester;

declare function getIngester(format: SourceFormat): Ingester;

export { type ConvertOptions, Converter, DOCXIngester, DOCXTransformer, FORMAT_INFO, type FormatInfo, HTMLTransformer, type Ingester, MarkdownParser, type OutputFormat, PDFIngester, PDFTransformer, type ParseOptions, type ParseResult, type SourceFormat, TXTTransformer, type Transformer, type TransformerOptions, convert, converter, docxIngester, docxTransformer, getIngester, getTransformer, htmlTransformer, pdfIngester, pdfTransformer, txtTransformer };
