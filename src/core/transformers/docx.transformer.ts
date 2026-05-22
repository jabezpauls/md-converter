import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ExternalHyperlink,
  AlignmentType,
  LevelFormat,
  convertInchesToTwip,
  type ParagraphChild,
} from 'docx';
import type {
  Root,
  Content,
  Heading,
  Code,
  List,
  ListItem,
  Blockquote,
  PhrasingContent,
  Table as MdastTable,
  TableRow as MdastTableRow,
  TableCell as MdastTableCell,
} from 'mdast';
import type { Transformer, TransformerOptions } from '../../types/index.js';
import { docxStyles, headingLevelMap } from '../styles/docx-styles.js';

interface RunOptions {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  code?: boolean;
}

export class DOCXTransformer implements Transformer {
  async transform(mdast: Root, _options: TransformerOptions = {}): Promise<Buffer> {
    const children = this.processNodes(mdast.children);

    const doc = new Document({
      styles: {
        paragraphStyles: docxStyles.paragraphStyles,
        characterStyles: docxStyles.characterStyles,
      },
      numbering: {
        config: [
          {
            reference: 'ordered-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: '%1.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
              {
                level: 1,
                format: LevelFormat.LOWER_LETTER,
                text: '%2.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
              {
                level: 2,
                format: LevelFormat.LOWER_ROMAN,
                text: '%3.',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
            ],
          },
          {
            reference: 'unordered-list',
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: '\u2022',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
              {
                level: 1,
                format: LevelFormat.BULLET,
                text: '\u25E6',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
              {
                level: 2,
                format: LevelFormat.BULLET,
                text: '\u25AA',
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) },
                  },
                },
              },
            ],
          },
        ],
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          children,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  private processNodes(nodes: Content[]): (Paragraph | Table)[] {
    const result: (Paragraph | Table)[] = [];

    for (const node of nodes) {
      const processed = this.processNode(node);
      if (Array.isArray(processed)) {
        result.push(...processed);
      } else if (processed) {
        result.push(processed);
      }
    }

    return result;
  }

  private processNode(node: Content, depth = 0): Paragraph | Table | (Paragraph | Table)[] | null {
    switch (node.type) {
      case 'heading':
        return this.processHeading(node);

      case 'paragraph':
        return this.processParagraph(node);

      case 'code':
        return this.processCodeBlock(node);

      case 'blockquote':
        return this.processBlockquote(node);

      case 'list':
        return this.processList(node, depth);

      case 'table':
        return this.processTable(node);

      case 'thematicBreak':
        return this.processThematicBreak();

      case 'html':
        // Skip raw HTML
        return null;

      default:
        return null;
    }
  }

  private processHeading(node: Heading): Paragraph {
    const level = Math.min(node.depth, 6) as 1 | 2 | 3 | 4 | 5 | 6;
    const runs = this.processInlineContent(node.children);

    return new Paragraph({
      children: runs,
      heading: headingLevelMap[level],
    });
  }

  private processParagraph(node: { children: PhrasingContent[] }): Paragraph {
    const runs = this.processInlineContent(node.children);

    return new Paragraph({
      children: runs,
      style: 'BodyText',
    });
  }

  private processCodeBlock(node: Code): Paragraph[] {
    const lines = node.value.split('\n');
    const paragraphs: Paragraph[] = [];

    // Add language label if present
    if (node.lang) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${node.lang}]`,
              font: 'Consolas',
              size: 18,
              color: '666666',
            }),
          ],
          spacing: { after: 60 },
        })
      );
    }

    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || ' ', // Empty lines need a space
              font: 'Consolas',
              size: 20,
            }),
          ],
          style: 'CodeBlock',
          shading: {
            fill: 'F5F5F5',
          },
        })
      );
    }

    return paragraphs;
  }

  private processBlockquote(node: Blockquote): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    for (const child of node.children) {
      if (child.type === 'paragraph') {
        const runs = this.processInlineContent(child.children);
        paragraphs.push(
          new Paragraph({
            children: runs,
            style: 'Quote',
          })
        );
      }
    }

    return paragraphs;
  }

  private processList(node: List, depth = 0): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const reference = node.ordered ? 'ordered-list' : 'unordered-list';

    for (let i = 0; i < node.children.length; i++) {
      const item = node.children[i] as ListItem;
      const itemParagraphs = this.processListItem(item, reference, depth);
      paragraphs.push(...itemParagraphs);
    }

    return paragraphs;
  }

  private processListItem(item: ListItem, reference: string, depth: number): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i];

      if (child.type === 'paragraph') {
        const runs: ParagraphChild[] = [];

        // Add checkbox for task lists
        if (item.checked !== null && item.checked !== undefined) {
          runs.push(
            new TextRun({
              text: item.checked ? '☑ ' : '☐ ',
              font: 'Segoe UI Symbol',
            })
          );
        }

        runs.push(...this.processInlineContent(child.children));

        paragraphs.push(
          new Paragraph({
            children: runs,
            numbering: i === 0 ? { reference, level: depth } : undefined,
            style: 'ListParagraph',
            indent: i > 0 ? { left: convertInchesToTwip(0.5 * (depth + 1)) } : undefined,
          })
        );
      } else if (child.type === 'list') {
        paragraphs.push(...this.processList(child, depth + 1));
      }
    }

    return paragraphs;
  }

  private processTable(node: MdastTable): Table {
    const rows: TableRow[] = [];

    for (let i = 0; i < node.children.length; i++) {
      const row = node.children[i] as MdastTableRow;
      const isHeader = i === 0;

      const cells = (row.children as MdastTableCell[]).map((cell, colIndex) => {
        const runs = this.processInlineContent(cell.children as PhrasingContent[]);
        const colAlign = node.align?.[colIndex];
        const alignmentType =
          colAlign === 'center' ? AlignmentType.CENTER :
          colAlign === 'right'  ? AlignmentType.RIGHT  :
          AlignmentType.LEFT;

        return new TableCell({
          children: [
            new Paragraph({
              children: runs,
              alignment: alignmentType,
            }),
          ],
          shading: isHeader ? { fill: 'E8E8E8' } : undefined,
        });
      });

      rows.push(
        new TableRow({
          children: cells,
          tableHeader: isHeader,
        })
      );
    }

    return new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
      },
    });
  }

  private processThematicBreak(): Paragraph {
    return new Paragraph({
      border: {
        bottom: {
          color: 'CCCCCC',
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { before: 200, after: 200 },
    });
  }

  private processInlineContent(nodes: PhrasingContent[], options: RunOptions = {}): (TextRun | ExternalHyperlink)[] {
    const runs: (TextRun | ExternalHyperlink)[] = [];

    for (const node of nodes) {
      const processed = this.processInlineNode(node, options);
      if (Array.isArray(processed)) {
        runs.push(...processed);
      } else if (processed) {
        runs.push(processed);
      }
    }

    return runs;
  }

  private processInlineNode(
    node: PhrasingContent,
    options: RunOptions = {}
  ): TextRun | ExternalHyperlink | (TextRun | ExternalHyperlink)[] | null {
    switch (node.type) {
      case 'text':
        return new TextRun({
          text: node.value,
          bold: options.bold,
          italics: options.italics,
          strike: options.strike,
          font: options.code ? 'Consolas' : 'Calibri',
          size: options.code ? 22 : 24,
          shading: options.code ? { fill: 'F5F5F5' } : undefined,
        });

      case 'strong':
        return this.processInlineContent(node.children, { ...options, bold: true });

      case 'emphasis':
        return this.processInlineContent(node.children, { ...options, italics: true });

      case 'delete':
        return this.processInlineContent(node.children, { ...options, strike: true });

      case 'inlineCode':
        return new TextRun({
          text: node.value,
          font: 'Consolas',
          size: 22,
          shading: { fill: 'F5F5F5' },
          bold: options.bold,
          italics: options.italics,
        });

      case 'link':
        return new ExternalHyperlink({
          children: [
            new TextRun({
              text: this.extractText(node.children),
              style: 'Hyperlink',
              color: '0066CC',
              underline: { type: 'single' },
            }),
          ],
          link: node.url,
        });

      case 'image':
        // Images would require fetching the image data
        // For now, just show alt text
        return new TextRun({
          text: `[Image: ${node.alt || 'image'}]`,
          italics: true,
          color: '666666',
        });

      case 'break':
        return new TextRun({ text: '', break: 1 });

      default:
        return null;
    }
  }

  private extractText(nodes: PhrasingContent[]): string {
    return nodes
      .map((node) => {
        if (node.type === 'text') return node.value;
        if ('children' in node) return this.extractText(node.children as PhrasingContent[]);
        return '';
      })
      .join('');
  }
}

export const docxTransformer = new DOCXTransformer();
