import type { Root, Content, PhrasingContent, TableCell, TableRow } from 'mdast';
import type { Transformer, TransformerOptions } from '../../types/index.js';

export class TXTTransformer implements Transformer {
  async transform(mdast: Root, _options: TransformerOptions = {}): Promise<Buffer> {
    const text = this.processNode(mdast);
    return Buffer.from(text.trim(), 'utf-8');
  }

  private processNode(node: Root | Content, depth = 0): string {
    switch (node.type) {
      case 'root':
        return node.children.map((child) => this.processNode(child, depth)).join('\n\n');

      case 'heading': {
        const prefix = '#'.repeat(node.depth) + ' ';
        const text = this.processChildren(node.children);
        return prefix + text;
      }

      case 'paragraph':
        return this.processChildren(node.children);

      case 'text':
        return node.value;

      case 'strong':
        return this.processChildren(node.children);

      case 'emphasis':
        return this.processChildren(node.children);

      case 'delete':
        return this.processChildren(node.children);

      case 'inlineCode':
        return `\`${node.value}\``;

      case 'code': {
        const lang = node.lang ? `[${node.lang}]\n` : '';
        const lines = node.value.split('\n').map((line) => '    ' + line);
        return lang + lines.join('\n');
      }

      case 'blockquote': {
        const content = node.children
          .map((child) => this.processNode(child, depth))
          .join('\n');
        return content
          .split('\n')
          .map((line) => '> ' + line)
          .join('\n');
      }

      case 'list': {
        return node.children
          .map((item, index) => {
            const prefix = node.ordered ? `${index + 1}. ` : '- ';
            const indent = '  '.repeat(depth);
            const content = this.processListItem(item, depth);
            return indent + prefix + content;
          })
          .join('\n');
      }

      case 'table':
        return this.formatTable(node.children as TableRow[]);

      case 'thematicBreak':
        return '---';

      case 'link':
        return `${this.processChildren(node.children)} (${node.url})`;

      case 'image':
        return `[${node.alt || 'image'}](${node.url})`;

      case 'break':
        return '\n';

      case 'html':
        return node.value;

      default:
        return '';
    }
  }

  private processChildren(children: PhrasingContent[]): string {
    return children.map((child) => this.processNode(child as Content)).join('');
  }

  private processListItem(item: Content, depth: number): string {
    if (item.type !== 'listItem') return '';

    const checkbox =
      item.checked === true ? '[x] ' : item.checked === false ? '[ ] ' : '';

    const parts: string[] = [];
    for (const child of item.children) {
      if (child.type === 'paragraph') {
        parts.push(this.processChildren(child.children));
      } else if (child.type === 'list') {
        parts.push('\n' + this.processNode(child, depth + 1));
      } else {
        parts.push(this.processNode(child, depth + 1));
      }
    }

    return checkbox + parts.join('\n');
  }

  private formatTable(rows: TableRow[]): string {
    if (rows.length === 0) return '';

    const data: string[][] = rows.map((row) =>
      (row.children as TableCell[]).map((cell) =>
        cell.children.map((child) => this.processNode(child as Content)).join('')
      )
    );

    const colWidths: number[] = [];
    for (const row of data) {
      row.forEach((cell, i) => {
        colWidths[i] = Math.max(colWidths[i] || 0, cell.length);
      });
    }

    const lines: string[] = [];

    // Header
    if (data.length > 0) {
      const header = data[0]
        .map((cell, i) => cell.padEnd(colWidths[i]))
        .join(' | ');
      lines.push(header);

      const separator = colWidths.map((w) => '-'.repeat(w)).join('-+-');
      lines.push(separator);

      // Body
      for (let i = 1; i < data.length; i++) {
        const row = data[i]
          .map((cell, j) => cell.padEnd(colWidths[j]))
          .join(' | ');
        lines.push(row);
      }
    }

    return lines.join('\n');
  }
}

export const txtTransformer = new TXTTransformer();
