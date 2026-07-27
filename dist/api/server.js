import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { readFile, writeFile } from 'fs/promises';
import { extname } from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { createHighlighter } from 'shiki';
import { UnderlineType, convertInchesToTwip, HeadingLevel, Document, AlignmentType, LevelFormat, Packer, Paragraph, TextRun, TableCell, TableRow, Table, BorderStyle, WidthType, ExternalHyperlink } from 'docx';
import puppeteer from 'puppeteer-core';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// src/api/server.ts
var MarkdownParser = class {
  parse(markdown, options = {}) {
    const { gfm: gfm2 = true } = options;
    const processor = unified().use(remarkParse);
    if (gfm2) {
      processor.use(remarkGfm);
    }
    const mdast = processor.parse(markdown);
    return { mdast };
  }
};

// src/core/styles/html-template.ts
var defaultHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
  <style>
    :root {
      --text-color: #1a1a1a;
      --heading-color: #E67E22;
      --link-color: #0066cc;
      --code-bg: #f5f5f5;
      --border-color: #ddd;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      font-size: 16px;
      line-height: 1.6;
      color: var(--text-color);
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      background: #fff;
    }

    h1, h2, h3, h4, h5, h6 {
      color: var(--heading-color);
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
      line-height: 1.3;
    }

    h1 {
      font-size: 2em;
      border-bottom: 2px solid var(--heading-color);
      padding-bottom: 0.3em;
    }

    h2 {
      font-size: 1.75em;
    }

    h3 {
      font-size: 1.5em;
    }

    h4 {
      font-size: 1.25em;
    }

    p {
      margin: 1em 0;
    }

    a {
      color: var(--link-color);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    code {
      font-family: 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9em;
      background: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
    }

    pre {
      background: var(--code-bg);
      padding: 1em;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
    }

    pre code {
      background: none;
      padding: 0;
      font-size: 0.875em;
      line-height: 1.5;
    }

    blockquote {
      margin: 1em 0;
      padding: 0.5em 1em;
      border-left: 4px solid var(--heading-color);
      background: #f9f9f9;
    }

    blockquote p {
      margin: 0.5em 0;
    }

    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }

    li {
      margin: 0.25em 0;
    }

    li > ul, li > ol {
      margin: 0.25em 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
    }

    th, td {
      border: 1px solid var(--border-color);
      padding: 0.75em;
      text-align: left;
    }

    th {
      background: var(--code-bg);
      font-weight: 600;
    }

    tr:nth-child(even) {
      background: #fafafa;
    }

    hr {
      border: none;
      border-top: 2px solid var(--border-color);
      margin: 2em 0;
    }

    img {
      max-width: 100%;
      height: auto;
    }

    .task-list-item {
      list-style: none;
      margin-left: -1.5em;
    }

    .task-list-item input[type="checkbox"] {
      margin-right: 0.5em;
    }

    del {
      color: #999;
    }

    @media print {
      body {
        max-width: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
{{content}}
</body>
</html>`;
function wrapInTemplate(content, title = "Document") {
  return defaultHtmlTemplate.replaceAll("{{title}}", title).replaceAll("{{content}}", content);
}

// src/core/transformers/html.transformer.ts
var highlighterPromise = null;
async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "python",
        "bash",
        "json",
        "html",
        "css",
        "markdown",
        "yaml",
        "sql",
        "go",
        "rust",
        "java",
        "c",
        "cpp"
      ]
    });
  }
  return highlighterPromise;
}
var HTMLTransformer = class {
  async transform(mdast, options = {}) {
    const { syntaxHighlight = true } = options;
    const processor = unified().use(remarkRehype, { allowDangerousHtml: true }).use(rehypeStringify, { allowDangerousHtml: true });
    const hast = await processor.run(mdast);
    let html = processor.stringify(hast);
    if (syntaxHighlight) {
      html = await this.highlightCodeBlocks(html);
    }
    const fullHtml = wrapInTemplate(html);
    return Buffer.from(fullHtml, "utf-8");
  }
  async highlightCodeBlocks(html) {
    const codeBlockRegex = /<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g;
    const highlighter = await getHighlighter();
    const matches = [];
    let match;
    while ((match = codeBlockRegex.exec(html)) !== null) {
      matches.push({
        full: match[0],
        lang: match[1],
        code: this.decodeHtmlEntities(match[2])
      });
    }
    for (const { full, lang, code } of matches) {
      try {
        const loadedLangs = highlighter.getLoadedLanguages();
        const langToUse = loadedLangs.includes(lang) ? lang : "text";
        const highlighted = highlighter.codeToHtml(code, {
          lang: langToUse,
          theme: "github-light"
        });
        html = html.replace(full, highlighted);
      } catch {
      }
    }
    return html;
  }
  decodeHtmlEntities(str) {
    return str.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  }
};
var htmlTransformer = new HTMLTransformer();

// src/core/transformers/txt.transformer.ts
var TXTTransformer = class {
  async transform(mdast, _options = {}) {
    const text = this.processNode(mdast);
    return Buffer.from(text.trim(), "utf-8");
  }
  processNode(node, depth = 0) {
    switch (node.type) {
      case "root":
        return node.children.map((child) => this.processNode(child, depth)).join("\n\n");
      case "heading": {
        const prefix = "#".repeat(node.depth) + " ";
        const text = this.processChildren(node.children);
        return prefix + text;
      }
      case "paragraph":
        return this.processChildren(node.children);
      case "text":
        return node.value;
      case "strong":
        return this.processChildren(node.children);
      case "emphasis":
        return this.processChildren(node.children);
      case "delete":
        return this.processChildren(node.children);
      case "inlineCode":
        return `\`${node.value}\``;
      case "code": {
        const lang = node.lang ? `[${node.lang}]
` : "";
        const lines = node.value.split("\n").map((line) => "    " + line);
        return lang + lines.join("\n");
      }
      case "blockquote": {
        const content = node.children.map((child) => this.processNode(child, depth)).join("\n");
        return content.split("\n").map((line) => "> " + line).join("\n");
      }
      case "list": {
        return node.children.map((item, index) => {
          const prefix = node.ordered ? `${index + 1}. ` : "- ";
          const indent = "  ".repeat(depth);
          const content = this.processListItem(item, depth);
          return indent + prefix + content;
        }).join("\n");
      }
      case "table":
        return this.formatTable(node.children);
      case "thematicBreak":
        return "---";
      case "link":
        return `${this.processChildren(node.children)} (${node.url})`;
      case "image":
        return `[${node.alt || "image"}](${node.url})`;
      case "break":
        return "\n";
      case "html":
        return node.value;
      default:
        return "";
    }
  }
  processChildren(children) {
    return children.map((child) => this.processNode(child)).join("");
  }
  processListItem(item, depth) {
    if (item.type !== "listItem") return "";
    const checkbox = item.checked === true ? "[x] " : item.checked === false ? "[ ] " : "";
    const parts = [];
    for (const child of item.children) {
      if (child.type === "paragraph") {
        parts.push(this.processChildren(child.children));
      } else if (child.type === "list") {
        parts.push("\n" + this.processNode(child, depth + 1));
      } else {
        parts.push(this.processNode(child, depth + 1));
      }
    }
    return checkbox + parts.join("\n");
  }
  formatTable(rows) {
    if (rows.length === 0) return "";
    const data = rows.map(
      (row) => row.children.map(
        (cell) => cell.children.map((child) => this.processNode(child)).join("")
      )
    );
    const colWidths = [];
    for (const row of data) {
      row.forEach((cell, i) => {
        colWidths[i] = Math.max(colWidths[i] || 0, cell.length);
      });
    }
    const lines = [];
    if (data.length > 0) {
      const header = data[0].map((cell, i) => cell.padEnd(colWidths[i])).join(" | ");
      lines.push(header);
      const separator = colWidths.map((w) => "-".repeat(w)).join("-+-");
      lines.push(separator);
      for (let i = 1; i < data.length; i++) {
        const row = data[i].map((cell, j) => cell.padEnd(colWidths[j])).join(" | ");
        lines.push(row);
      }
    }
    return lines.join("\n");
  }
};
var txtTransformer = new TXTTransformer();
var HEADING_COLOR = "E67E22";
var docxStyles = {
  paragraphStyles: [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        size: 64,
        // 32pt * 2
        bold: true,
        color: HEADING_COLOR,
        font: "Calibri Light"
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.25),
          after: convertInchesToTwip(0.1)
        }
      }
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        size: 52,
        // 26pt * 2
        bold: true,
        color: HEADING_COLOR,
        font: "Calibri Light"
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.2),
          after: convertInchesToTwip(0.08)
        }
      }
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: {
        size: 44,
        // 22pt * 2
        bold: true,
        color: HEADING_COLOR,
        font: "Calibri Light"
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.15),
          after: convertInchesToTwip(0.06)
        }
      }
    },
    {
      id: "BodyText",
      name: "Body Text",
      basedOn: "Normal",
      next: "BodyText",
      quickFormat: true,
      run: {
        size: 24,
        // 12pt * 2
        font: "Calibri"
      },
      paragraph: {
        spacing: {
          after: convertInchesToTwip(0.1),
          line: 276
          // 1.15 line spacing
        }
      }
    },
    {
      id: "CodeBlock",
      name: "Code Block",
      basedOn: "Normal",
      quickFormat: true,
      run: {
        size: 20,
        // 10pt * 2
        font: "Consolas"
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.1),
          after: convertInchesToTwip(0.1)
        },
        shading: {
          fill: "F5F5F5"
        }
      }
    },
    {
      id: "ListParagraph",
      name: "List Paragraph",
      basedOn: "Normal",
      quickFormat: true,
      run: {
        size: 24,
        font: "Calibri"
      },
      paragraph: {
        spacing: {
          after: convertInchesToTwip(0.05)
        }
      }
    },
    {
      id: "Quote",
      name: "Quote",
      basedOn: "Normal",
      quickFormat: true,
      run: {
        size: 24,
        font: "Calibri",
        italics: true,
        color: "666666"
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.1),
          after: convertInchesToTwip(0.1)
        },
        indent: {
          left: convertInchesToTwip(0.5)
        },
        border: {
          left: {
            color: HEADING_COLOR,
            size: 24,
            style: "single"
          }
        }
      }
    }
  ],
  characterStyles: [
    {
      id: "InlineCode",
      name: "Inline Code",
      basedOn: "DefaultParagraphFont",
      run: {
        font: "Consolas",
        size: 22,
        shading: {
          fill: "F5F5F5"
        }
      }
    },
    {
      id: "Hyperlink",
      name: "Hyperlink",
      basedOn: "DefaultParagraphFont",
      run: {
        color: "0066CC",
        underline: {
          type: UnderlineType.SINGLE
        }
      }
    }
  ]
};
var headingLevelMap = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6
};

// src/core/transformers/docx.transformer.ts
var DOCXTransformer = class {
  async transform(mdast, _options = {}) {
    const children = this.processNodes(mdast.children);
    const doc = new Document({
      styles: {
        paragraphStyles: docxStyles.paragraphStyles,
        characterStyles: docxStyles.characterStyles
      },
      numbering: {
        config: [
          {
            reference: "ordered-list",
            levels: [
              {
                level: 0,
                format: LevelFormat.DECIMAL,
                text: "%1.",
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) }
                  }
                }
              },
              {
                level: 1,
                format: LevelFormat.LOWER_LETTER,
                text: "%2.",
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) }
                  }
                }
              },
              {
                level: 2,
                format: LevelFormat.LOWER_ROMAN,
                text: "%3.",
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) }
                  }
                }
              }
            ]
          },
          {
            reference: "unordered-list",
            levels: [
              {
                level: 0,
                format: LevelFormat.BULLET,
                text: "\u2022",
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) }
                  }
                }
              },
              {
                level: 1,
                format: LevelFormat.BULLET,
                text: "\u25E6",
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) }
                  }
                }
              },
              {
                level: 2,
                format: LevelFormat.BULLET,
                text: "\u25AA",
                alignment: AlignmentType.START,
                style: {
                  paragraph: {
                    indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) }
                  }
                }
              }
            ]
          }
        ]
      },
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1)
              }
            }
          },
          children
        }
      ]
    });
    return Packer.toBuffer(doc);
  }
  processNodes(nodes) {
    const result = [];
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
  processNode(node, depth = 0) {
    switch (node.type) {
      case "heading":
        return this.processHeading(node);
      case "paragraph":
        return this.processParagraph(node);
      case "code":
        return this.processCodeBlock(node);
      case "blockquote":
        return this.processBlockquote(node);
      case "list":
        return this.processList(node, depth);
      case "table":
        return this.processTable(node);
      case "thematicBreak":
        return this.processThematicBreak();
      case "html":
        return null;
      default:
        return null;
    }
  }
  processHeading(node) {
    const level = Math.min(node.depth, 6);
    const runs = this.processInlineContent(node.children);
    return new Paragraph({
      children: runs,
      heading: headingLevelMap[level]
    });
  }
  processParagraph(node) {
    const runs = this.processInlineContent(node.children);
    return new Paragraph({
      children: runs,
      style: "BodyText"
    });
  }
  processCodeBlock(node) {
    const lines = node.value.split("\n");
    const paragraphs = [];
    if (node.lang) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${node.lang}]`,
              font: "Consolas",
              size: 18,
              color: "666666"
            })
          ],
          spacing: { after: 60 }
        })
      );
    }
    for (const line of lines) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || " ",
              // Empty lines need a space
              font: "Consolas",
              size: 20
            })
          ],
          style: "CodeBlock",
          shading: {
            fill: "F5F5F5"
          }
        })
      );
    }
    return paragraphs;
  }
  processBlockquote(node) {
    const paragraphs = [];
    for (const child of node.children) {
      if (child.type === "paragraph") {
        const runs = this.processInlineContent(child.children);
        paragraphs.push(
          new Paragraph({
            children: runs,
            style: "Quote"
          })
        );
      }
    }
    return paragraphs;
  }
  processList(node, depth = 0) {
    const paragraphs = [];
    const reference = node.ordered ? "ordered-list" : "unordered-list";
    for (let i = 0; i < node.children.length; i++) {
      const item = node.children[i];
      const itemParagraphs = this.processListItem(item, reference, depth);
      paragraphs.push(...itemParagraphs);
    }
    return paragraphs;
  }
  processListItem(item, reference, depth) {
    const paragraphs = [];
    for (let i = 0; i < item.children.length; i++) {
      const child = item.children[i];
      if (child.type === "paragraph") {
        const runs = [];
        if (item.checked !== null && item.checked !== void 0) {
          runs.push(
            new TextRun({
              text: item.checked ? "\u2611 " : "\u2610 ",
              font: "Segoe UI Symbol"
            })
          );
        }
        runs.push(...this.processInlineContent(child.children));
        paragraphs.push(
          new Paragraph({
            children: runs,
            numbering: i === 0 ? { reference, level: depth } : void 0,
            style: "ListParagraph",
            indent: i > 0 ? { left: convertInchesToTwip(0.5 * (depth + 1)) } : void 0
          })
        );
      } else if (child.type === "list") {
        paragraphs.push(...this.processList(child, depth + 1));
      }
    }
    return paragraphs;
  }
  processTable(node) {
    const rows = [];
    for (let i = 0; i < node.children.length; i++) {
      const row = node.children[i];
      const isHeader = i === 0;
      const cells = row.children.map((cell, colIndex) => {
        const runs = this.processInlineContent(cell.children);
        const colAlign = node.align?.[colIndex];
        const alignmentType = colAlign === "center" ? AlignmentType.CENTER : colAlign === "right" ? AlignmentType.RIGHT : AlignmentType.LEFT;
        return new TableCell({
          children: [
            new Paragraph({
              children: runs,
              alignment: alignmentType
            })
          ],
          shading: isHeader ? { fill: "E8E8E8" } : void 0
        });
      });
      rows.push(
        new TableRow({
          children: cells,
          tableHeader: isHeader
        })
      );
    }
    return new Table({
      rows,
      width: {
        size: 100,
        type: WidthType.PERCENTAGE
      },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }
      }
    });
  }
  processThematicBreak() {
    return new Paragraph({
      border: {
        bottom: {
          color: "CCCCCC",
          style: BorderStyle.SINGLE,
          size: 6
        }
      },
      spacing: { before: 200, after: 200 }
    });
  }
  processInlineContent(nodes, options = {}) {
    const runs = [];
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
  processInlineNode(node, options = {}) {
    switch (node.type) {
      case "text":
        return new TextRun({
          text: node.value,
          bold: options.bold,
          italics: options.italics,
          strike: options.strike,
          font: options.code ? "Consolas" : "Calibri",
          size: options.code ? 22 : 24,
          shading: options.code ? { fill: "F5F5F5" } : void 0
        });
      case "strong":
        return this.processInlineContent(node.children, { ...options, bold: true });
      case "emphasis":
        return this.processInlineContent(node.children, { ...options, italics: true });
      case "delete":
        return this.processInlineContent(node.children, { ...options, strike: true });
      case "inlineCode":
        return new TextRun({
          text: node.value,
          font: "Consolas",
          size: 22,
          shading: { fill: "F5F5F5" },
          bold: options.bold,
          italics: options.italics
        });
      case "link":
        return new ExternalHyperlink({
          children: [
            new TextRun({
              text: this.extractText(node.children),
              style: "Hyperlink",
              color: "0066CC",
              underline: { type: "single" }
            })
          ],
          link: node.url
        });
      case "image":
        return new TextRun({
          text: `[Image: ${node.alt || "image"}]`,
          italics: true,
          color: "666666"
        });
      case "break":
        return new TextRun({ text: "", break: 1 });
      default:
        return null;
    }
  }
  extractText(nodes) {
    return nodes.map((node) => {
      if (node.type === "text") return node.value;
      if ("children" in node) return this.extractText(node.children);
      return "";
    }).join("");
  }
};
var docxTransformer = new DOCXTransformer();
var CHROME_PATHS = [
  // Linux
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/snap/bin/chromium",
  // macOS
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  // Windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
];
async function findChrome() {
  const { existsSync } = await import('fs');
  for (const path of CHROME_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  try {
    const { execSync } = await import('child_process');
    const chromePath = execSync("which google-chrome || which chromium || which chromium-browser", {
      encoding: "utf-8"
    }).trim();
    if (chromePath) {
      return chromePath;
    }
  } catch {
  }
  throw new Error(
    "Chrome/Chromium not found. Please install Chrome or Chromium, or set CHROME_PATH environment variable."
  );
}
var PDFTransformer = class {
  browser = null;
  htmlTransformer;
  constructor() {
    this.htmlTransformer = new HTMLTransformer();
  }
  async transform(mdast, options = {}) {
    const { pageSize = "A4" } = options;
    const htmlBuffer = await this.htmlTransformer.transform(mdast, options);
    const html = htmlBuffer.toString("utf-8");
    return this.htmlToPdf(html, pageSize);
  }
  async htmlToPdf(html, pageSize) {
    const browser = await this.getBrowser();
    let page = null;
    try {
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });
      const pdfBuffer = await page.pdf({
        format: pageSize,
        printBackground: true,
        margin: {
          top: "1in",
          right: "1in",
          bottom: "1in",
          left: "1in"
        }
      });
      return Buffer.from(pdfBuffer);
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
  async getBrowser() {
    if (!this.browser || !this.browser.connected) {
      const executablePath = process.env.CHROME_PATH || await findChrome();
      this.browser = await puppeteer.launch({
        executablePath,
        headless: true,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-background-networking",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-breakpad",
          "--disable-client-side-phishing-detection",
          "--disable-component-update",
          "--disable-default-apps",
          "--disable-extensions",
          "--disable-features=site-per-process",
          "--disable-hang-monitor",
          "--disable-ipc-flooding-protection",
          "--disable-popup-blocking",
          "--disable-prompt-on-repost",
          "--disable-renderer-backgrounding",
          "--disable-sync",
          "--disable-translate",
          "--metrics-recording-only",
          "--no-first-run",
          "--safebrowsing-disable-auto-update",
          "--enable-automation",
          "--password-store=basic",
          "--use-mock-keychain"
        ]
      });
    }
    return this.browser;
  }
  async dispose() {
    if (this.browser) {
      const process2 = this.browser.process();
      await this.browser.close();
      if (process2 && !process2.killed) {
        process2.kill("SIGKILL");
      }
      this.browser = null;
    }
  }
};
var pdfTransformer = new PDFTransformer();

// src/core/transformers/index.ts
var transformers = {
  html: htmlTransformer,
  txt: txtTransformer,
  docx: docxTransformer,
  pdf: pdfTransformer
};
function getTransformer(format) {
  const transformer = transformers[format];
  if (!transformer) {
    throw new Error(`Unsupported format: ${format}`);
  }
  return transformer;
}
function createTurndown() {
  const service = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced"
  });
  service.use(gfm);
  service.addRule("cellParagraph", {
    filter: (node) => node.nodeName === "P" && node.parentNode !== null && (node.parentNode.nodeName === "TD" || node.parentNode.nodeName === "TH"),
    replacement: (content) => content
  });
  return service;
}
var DOCXIngester = class {
  async ingest(input) {
    const { value: html } = await mammoth.convertToHtml(
      { buffer: input },
      { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) }
    );
    const markdown = createTurndown().turndown(html);
    return markdown.trim() + "\n";
  }
};
var docxIngester = new DOCXIngester();

// src/core/ingesters/pdf.ingester.ts
var LINE_Y_TOLERANCE = 0.35;
var LINE_Y_MIN = 1.5;
var SPACE_GAP_RATIO = 0.12;
var PARAGRAPH_GAP_RATIO = 1.75;
var HEADING_SIZE_RATIO = 1.15;
var HEADER_FOOTER_RE = /(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w.-]+\.\w{2,}\b|\(\+\d{1,3}\)\s*[\d-]+|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i;
var SECTION_LABEL_RE = /^[A-Z][A-Za-z0-9 /&'()-]{0,48}:$/;
var KEY_VALUE_RE = /^([A-Z][A-Za-z0-9 /&'()-]{1,48}):\s+(\S.*)$/;
function textItemToExtracted(item) {
  const transform = item.transform;
  const fontSize = Math.abs(Number(transform[0]) || Number(item.height) || 12);
  return {
    str: item.str,
    x: Number(transform[4]) || 0,
    y: Number(transform[5]) || 0,
    width: Number(item.width) || 0,
    height: Number(item.height) || fontSize,
    fontSize,
    hasEOL: Boolean(item.hasEOL)
  };
}
function mode(values) {
  if (!values.length) return 12;
  const counts = /* @__PURE__ */ new Map();
  for (const v of values) {
    const key = Math.round(v * 10) / 10;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = values[0];
  let bestCount = 0;
  for (const [size, count] of counts) {
    if (count > bestCount || count === bestCount && size < best) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}
function needsSpace(prev, next) {
  if (!prev.str || !next.str) return false;
  if (/\s$/.test(prev.str) || /^\s/.test(next.str)) return false;
  if (prev.str.endsWith("-") && /^[a-z]/.test(next.str)) return false;
  const gap = next.x - (prev.x + prev.width);
  const fontSize = Math.max(prev.fontSize, next.fontSize, 1);
  if (gap <= fontSize * SPACE_GAP_RATIO) {
    if (gap >= -fontSize * 0.05 && /[A-Za-z0-9)]$/.test(prev.str) && /^[A-Za-z(]/.test(next.str)) {
      if (prev.width <= 0 || next.width <= 0 || gap > fontSize * 0.02) return true;
    }
    return false;
  }
  return true;
}
function joinLineText(items) {
  const sorted = [...items].sort((a, b) => a.x - b.x || b.y - a.y);
  let text = "";
  let prev = null;
  for (const item of sorted) {
    if (!item.str) continue;
    if (text && prev && needsSpace(prev, item)) {
      if (!/\s$/.test(text) && !/^\s/.test(item.str)) text += " ";
    }
    text += item.str;
    prev = item;
  }
  return text.replace(/[ \t]+/g, " ").trim();
}
function itemsToLines(items) {
  const usable = items.filter((i) => i.str.trim().length > 0);
  if (!usable.length) return [];
  const sorted = [...usable].sort((a, b) => b.y - a.y || a.x - b.x);
  const bands = [];
  for (const item of sorted) {
    const band = bands[bands.length - 1];
    if (!band) {
      bands.push([item]);
      continue;
    }
    const ref = band[0];
    const tol = Math.max(LINE_Y_MIN, Math.max(ref.fontSize, item.fontSize) * LINE_Y_TOLERANCE);
    if (Math.abs(ref.y - item.y) <= tol) {
      band.push(item);
    } else {
      bands.push([item]);
    }
  }
  return bands.map((band) => {
    const text = joinLineText(band);
    const fontSize = Math.max(...band.map((i) => i.fontSize));
    const height = Math.max(...band.map((i) => i.height || i.fontSize));
    const y = band.reduce((s, i) => s + i.y, 0) / band.length;
    const x = Math.min(...band.map((i) => i.x));
    return { y, x, text, fontSize, height };
  }).filter((l) => l.text.length > 0);
}
function stripInlineChrome(text) {
  if (!HEADER_FOOTER_RE.test(text)) return text.trim();
  return text.replace(/(?:https?:\/\/|www\.)\S+/gi, "").replace(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g, "").replace(/\(\+\d{1,3}\)\s*[\d-]+/g, "").replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "").replace(/[|/·•,;]+/g, " ").replace(/\s+/g, " ").trim();
}
function isPureChrome(text) {
  const t = text.trim();
  if (!t) return true;
  if (!HEADER_FOOTER_RE.test(t)) return false;
  return stripInlineChrome(t).length === 0;
}
function stripHeadersAndFooters(pages) {
  if (!pages.length) return pages;
  const counts = /* @__PURE__ */ new Map();
  for (const page of pages) {
    const seen = /* @__PURE__ */ new Set();
    for (const line of page) {
      const key = line.text.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const repeated = new Set(
    [...counts.entries()].filter(([, n]) => n >= 2 && pages.length >= 2).map(([k]) => k)
  );
  return pages.map(
    (page) => page.map((line) => {
      const raw = line.text.trim();
      if (!raw) return null;
      if (repeated.has(raw.toLowerCase()) && isPureChrome(raw)) return null;
      if (repeated.has(raw.toLowerCase()) && HEADER_FOOTER_RE.test(raw) && stripInlineChrome(raw).length === 0) {
        return null;
      }
      if (repeated.has(raw.toLowerCase()) && !HEADER_FOOTER_RE.test(raw)) {
        if (raw.length <= 80) return null;
      }
      if (isPureChrome(raw)) return null;
      const cleaned = stripInlineChrome(raw);
      if (!cleaned) return null;
      return cleaned === raw ? line : { ...line, text: cleaned };
    }).filter((l) => l !== null)
  );
}
function joinWrappedLines(parts) {
  if (!parts.length) return "";
  let out = parts[0].trim();
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i].trim();
    if (!next) continue;
    if (out.endsWith("-") && /^[a-z0-9]/.test(next)) {
      out += next;
      continue;
    }
    if (!/\s$/.test(out) && !/^\s/.test(next)) out += " ";
    out += next;
  }
  return out.replace(/\s+/g, " ").trim();
}
function headingLevel(fontSize, bodySize) {
  if (fontSize < bodySize * HEADING_SIZE_RATIO) return 0;
  if (fontSize >= bodySize * 1.8) return 1;
  if (fontSize >= bodySize * 1.4) return 2;
  return 3;
}
function formatHeading(text, level) {
  const cleaned = text.replace(/:$/, "").trim();
  const hashes = "#".repeat(Math.max(1, Math.min(level, 6)));
  return `${hashes} ${cleaned}`;
}
function formatKeyValue(text) {
  const m = text.match(KEY_VALUE_RE);
  if (!m) return null;
  const [, key, value] = m;
  if (key.length > 48 || value.length > 500) return null;
  if (key.split(/\s+/).length > 6) return null;
  return `- **${key}:** ${value.trim()}`;
}
function joinBlocks(blocks) {
  let out = "";
  for (let i = 0; i < blocks.length; i++) {
    if (i > 0) {
      const bothListItems = blocks[i].startsWith("- ") && blocks[i - 1].startsWith("- ");
      out += bothListItems ? "\n" : "\n\n";
    }
    out += blocks[i];
  }
  return out.trim();
}
function linesToMarkdown(lines) {
  if (!lines.length) return "";
  const bodySize = mode(lines.map((l) => l.fontSize));
  const blocks = [];
  let para = [];
  let pendingTitle = false;
  let headingBuf = null;
  const flushHeading = () => {
    if (!headingBuf) return;
    blocks.push(formatHeading(joinWrappedLines(headingBuf.parts), headingBuf.level));
    headingBuf = null;
  };
  const flushPara = () => {
    if (!para.length) return;
    const text = joinWrappedLines(para.map((l) => l.text));
    para = [];
    if (!text) return;
    if (pendingTitle) {
      blocks.push(formatHeading(text, 1));
      pendingTitle = false;
      return;
    }
    const kv = formatKeyValue(text);
    if (kv) {
      blocks.push(kv);
      return;
    }
    blocks.push(text);
  };
  const shouldBreakBefore = (line, text) => {
    if (SECTION_LABEL_RE.test(text) && text.length <= 40) return true;
    if (headingLevel(line.fontSize, bodySize) > 0 && text.length <= 120 && !/[,;]$/.test(text)) {
      return true;
    }
    if (para.length && KEY_VALUE_RE.test(text) && KEY_VALUE_RE.test(para[0].text.trim())) {
      return true;
    }
    return false;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const text = line.text.trim();
    if (!text) continue;
    if (/^title:$/i.test(text)) {
      flushHeading();
      flushPara();
      pendingTitle = true;
      continue;
    }
    if (pendingTitle) {
      flushHeading();
      if (SECTION_LABEL_RE.test(text) && text.length <= 40) {
        flushPara();
        pendingTitle = false;
        blocks.push(formatHeading(text, 2));
        continue;
      }
      const prev2 = para[para.length - 1];
      if (prev2) {
        const gap2 = prev2.y - line.y;
        const refHeight2 = Math.max(prev2.height, line.height, prev2.fontSize, line.fontSize, bodySize);
        if (gap2 > refHeight2 * PARAGRAPH_GAP_RATIO) {
          flushPara();
        } else {
          para.push(line);
          continue;
        }
      } else {
        para.push(line);
        continue;
      }
    }
    if (SECTION_LABEL_RE.test(text) && text.length <= 40) {
      flushHeading();
      flushPara();
      blocks.push(formatHeading(text, 2));
      continue;
    }
    const level = headingLevel(line.fontSize, bodySize);
    if (level > 0 && text.length <= 120 && !/[,;]$/.test(text)) {
      flushPara();
      if (headingBuf && headingBuf.level === level && Math.abs(headingBuf.fontSize - line.fontSize) < 0.5) {
        headingBuf.parts.push(text);
      } else {
        flushHeading();
        headingBuf = { level, parts: [text], fontSize: line.fontSize };
      }
      continue;
    }
    flushHeading();
    if (shouldBreakBefore(line, text)) {
      flushPara();
    }
    const prev = para[para.length - 1];
    if (!prev) {
      para.push(line);
      continue;
    }
    const gap = prev.y - line.y;
    const refHeight = Math.max(prev.height, line.height, prev.fontSize, line.fontSize, bodySize);
    if (gap > refHeight * PARAGRAPH_GAP_RATIO) {
      flushPara();
      para.push(line);
    } else {
      para.push(line);
    }
  }
  flushHeading();
  flushPara();
  return joinBlocks(blocks);
}
var PDFIngester = class {
  async ingest(input) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await getDocument({
      data: new Uint8Array(input),
      verbosity: 0
    }).promise;
    const pageLines = [];
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const items = content.items.filter((i) => "str" in i).map(textItemToExtracted);
      pageLines.push(itemsToLines(items));
    }
    await doc.destroy();
    const cleaned = stripHeadersAndFooters(pageLines);
    const pages = cleaned.map(linesToMarkdown).filter(Boolean);
    return pages.join("\n\n---\n\n").trim() + "\n";
  }
};
var pdfIngester = new PDFIngester();

// src/core/ingesters/index.ts
var ingesters = {
  docx: docxIngester,
  pdf: pdfIngester
};
function getIngester(format) {
  const ingester = ingesters[format];
  if (!ingester) {
    throw new Error(`Unsupported source format: ${format}`);
  }
  return ingester;
}

// src/core/converter.ts
var SOURCE_EXTENSIONS = {
  ".docx": "docx",
  ".pdf": "pdf"
};
var Converter = class {
  parser;
  constructor() {
    this.parser = new MarkdownParser();
  }
  async convert(input, options) {
    const markdown = typeof input === "string" ? input : input.toString("utf-8");
    const { format, syntaxHighlight = true, pageSize = "A4" } = options;
    const { mdast } = this.parser.parse(markdown);
    const transformer = getTransformer(format);
    return transformer.transform(mdast, {
      syntaxHighlight,
      pageSize
    });
  }
  async convertToMarkdown(input, sourceFormat) {
    return getIngester(sourceFormat).ingest(input);
  }
  async convertFile(inputPath, outputPath, options) {
    const input = await readFile(inputPath);
    if (options.format === "md") {
      const sourceFormat = SOURCE_EXTENSIONS[extname(inputPath).toLowerCase()];
      if (!sourceFormat) {
        throw new Error(
          `Cannot convert to Markdown from "${extname(inputPath)}". Supported source formats: ${Object.keys(SOURCE_EXTENSIONS).join(", ")}`
        );
      }
      const markdown = await this.convertToMarkdown(input, sourceFormat);
      await writeFile(outputPath, markdown);
      return;
    }
    const output = await this.convert(input, options);
    await writeFile(outputPath, output);
  }
};
var converter = new Converter();

// src/types/index.ts
var FORMAT_INFO = {
  docx: {
    id: "docx",
    name: "Microsoft Word",
    extension: ".docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  },
  pdf: {
    id: "pdf",
    name: "PDF Document",
    extension: ".pdf",
    mimeType: "application/pdf"
  },
  html: {
    id: "html",
    name: "HTML Document",
    extension: ".html",
    mimeType: "text/html"
  },
  txt: {
    id: "txt",
    name: "Plain Text",
    extension: ".txt",
    mimeType: "text/plain"
  },
  md: {
    id: "md",
    name: "Markdown",
    extension: ".md",
    mimeType: "text/markdown"
  }
};

// src/api/routes/convert.ts
var validFormats = ["docx", "pdf", "txt", "html"];
function isValidFormat(format) {
  return validFormats.includes(format);
}
async function convertRoutes(fastify) {
  fastify.post(
    "/convert",
    {
      schema: {
        body: {
          type: "object",
          required: ["markdown", "format"],
          properties: {
            markdown: { type: "string" },
            format: { type: "string", enum: validFormats },
            options: {
              type: "object",
              properties: {
                syntaxHighlight: { type: "boolean" },
                pageSize: { type: "string", enum: ["A4", "Letter"] }
              }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const { markdown, format, options = {} } = request.body;
      if (!isValidFormat(format)) {
        return reply.status(400).send({
          error: "Invalid format",
          code: "INVALID_FORMAT",
          details: `Format must be one of: ${validFormats.join(", ")}`
        });
      }
      try {
        const buffer = await converter.convert(markdown, {
          format,
          syntaxHighlight: options.syntaxHighlight ?? true,
          pageSize: options.pageSize ?? "A4"
        });
        const formatInfo = FORMAT_INFO[format];
        return reply.header("Content-Type", formatInfo.mimeType).header(
          "Content-Disposition",
          `attachment; filename="output${formatInfo.extension}"`
        ).send(buffer);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: "Conversion failed",
          code: "CONVERSION_ERROR",
          details: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  );
  fastify.post("/convert/file", async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({
        error: "No file uploaded",
        code: "NO_FILE",
        details: "Please upload a markdown file"
      });
    }
    const format = data.fields.format?.value;
    const syntaxHighlightField = data.fields.syntaxHighlight?.value;
    const pageSizeField = data.fields.pageSize?.value;
    if (!format || !isValidFormat(format)) {
      return reply.status(400).send({
        error: "Invalid or missing format",
        code: "INVALID_FORMAT",
        details: `Format must be one of: ${validFormats.join(", ")}`
      });
    }
    try {
      const chunks = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const markdown = Buffer.concat(chunks).toString("utf-8");
      const buffer = await converter.convert(markdown, {
        format,
        syntaxHighlight: syntaxHighlightField !== "false",
        pageSize: pageSizeField ?? "A4"
      });
      const formatInfo = FORMAT_INFO[format];
      const originalName = data.filename.replace(/\.[^/.]+$/, "");
      return reply.header("Content-Type", formatInfo.mimeType).header(
        "Content-Disposition",
        `attachment; filename="${originalName}${formatInfo.extension}"`
      ).send(buffer);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: "Conversion failed",
        code: "CONVERSION_ERROR",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}

// src/api/routes/health.ts
var startTime = Date.now();
async function healthRoutes(fastify) {
  fastify.get("/health", async () => {
    return {
      status: "healthy",
      version: "1.0.0",
      uptime: Math.floor((Date.now() - startTime) / 1e3)
    };
  });
  fastify.get("/formats", async () => {
    return {
      formats: [
        {
          id: "docx",
          name: "Microsoft Word",
          extension: ".docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          features: ["styles", "tables", "lists", "code-blocks"]
        },
        {
          id: "pdf",
          name: "PDF Document",
          extension: ".pdf",
          mimeType: "application/pdf",
          features: ["syntax-highlight", "page-size"]
        },
        {
          id: "html",
          name: "HTML Document",
          extension: ".html",
          mimeType: "text/html",
          features: ["syntax-highlight", "standalone"]
        },
        {
          id: "txt",
          name: "Plain Text",
          extension: ".txt",
          mimeType: "text/plain",
          features: ["ascii-tables"]
        }
      ]
    };
  });
}

// src/api/server.ts
async function createServer(options = {}) {
  const { logger = true } = options;
  const fastify = Fastify({ logger });
  await fastify.register(cors, { origin: true });
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024
      // 10MB
    }
  });
  await fastify.register(healthRoutes, { prefix: "/api/v1" });
  await fastify.register(convertRoutes, { prefix: "/api/v1" });
  fastify.addHook("onClose", async () => {
    await pdfTransformer.dispose();
  });
  fastify.get("/", async () => {
    return {
      name: "md-convert",
      version: "1.0.0",
      description: "Markdown to DOCX/PDF/TXT/HTML converter API",
      endpoints: {
        health: "/api/v1/health",
        formats: "/api/v1/formats",
        convert: "POST /api/v1/convert",
        convertFile: "POST /api/v1/convert/file"
      }
    };
  });
  return fastify;
}
async function startServer(options = {}) {
  const { port = 3e3, host = "0.0.0.0" } = options;
  const server = await createServer(options);
  try {
    await server.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
var isMainModule = process.argv[1]?.includes("server");
if (isMainModule) {
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";
  startServer({ port, host });
}

export { createServer, startServer };
//# sourceMappingURL=server.js.map
//# sourceMappingURL=server.js.map