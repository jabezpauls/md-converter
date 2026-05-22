export const defaultHtmlTemplate = `<!DOCTYPE html>
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

export function wrapInTemplate(content: string, title = 'Document'): string {
  return defaultHtmlTemplate
    .replaceAll('{{title}}', title)
    .replaceAll('{{content}}', content);
}
