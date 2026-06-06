# md-converter

A command-line tool for converting Markdown files to DOCX, PDF, HTML, and plain text — and for converting PDF and DOCX files back to Markdown. Supports GitHub Flavored Markdown including tables, task lists, and syntax-highlighted code blocks.

## Installation

You'll need Node.js 18 or higher. For PDF conversion, you'll also need Chrome or Chromium installed.

```bash
npm install -g @jabezpauls/md-converter
```

## Usage

Basic usage is straightforward:

```bash
md-converter document.md -f docx
```

This converts `document.md` to `document.docx` in the same directory.

### Examples

Convert to different formats:

```bash
md-converter document.md -f pdf
md-converter document.md -f html
md-converter document.md -f txt
```

Specify a custom output path:

```bash
md-converter document.md -f pdf -o reports/output.pdf
```

Convert a PDF or Word document back to Markdown:

```bash
md-converter report.pdf -f md
md-converter notes.docx -f md -o notes.md
```

The source format is detected from the input file extension (`.pdf` or `.docx`).
DOCX conversion preserves headings, lists, tables, and inline formatting. PDF
extraction is text-based and best-effort — layout-dependent structure such as
columns and tables may not survive.

See what's happening with verbose output:

```bash
md-converter document.md -f docx -v
```

### Available Options

```
-f, --format <format>     Output format: docx, pdf, html, txt, md (required)
-o, --output <path>       Custom output file path
--no-syntax-highlight     Disable code syntax highlighting
--page-size <size>        PDF page size: A4 or Letter (default: A4)
-v, --verbose            Show detailed output
-h, --help               Display help
-V, --version            Show version number
```

## What Gets Converted

The converter handles standard Markdown plus GitHub Flavored Markdown extensions:

- Headings (H1 through H6)
- Text formatting: **bold**, *italic*, ~~strikethrough~~
- Code blocks with syntax highlighting for common languages
- Inline `code`
- Tables
- Task lists with `[ ]` and `[x]` checkboxes
- Ordered and unordered lists
- Blockquotes
- Links and images
- Horizontal rules

## Output Formats

**DOCX (Microsoft Word)**
Creates proper Word documents with heading styles (in orange), body text, tables with borders, and monospaced code blocks. Compatible with Word 2007 and later.

**PDF**
Generates PDFs using headless Chrome for accurate rendering. Includes syntax-highlighted code blocks and supports A4 or Letter page sizes with 1-inch margins.

**HTML**
Produces standalone HTML files with embedded CSS. The output is responsive, print-friendly, and includes syntax highlighting for code blocks.

**TXT (Plain Text)**
Extracts plain text while preserving document structure. Tables are formatted as ASCII art.

## Web API

If you need to convert markdown programmatically, there's a built-in REST API.

First, clone and run the server:

```bash
git clone https://github.com/jabezpauls/md-converter.git
cd md-converter
npm install
npm run server
```

The server starts on `http://localhost:3000`.

### Convert via JSON

```bash
curl -X POST http://localhost:3000/api/v1/convert \
  -H "Content-Type: application/json" \
  -d '{"markdown": "# Hello World", "format": "docx"}' \
  --output output.docx
```

### Upload a file

```bash
curl -X POST http://localhost:3000/api/v1/convert/file \
  -F "file=@document.md" \
  -F "format=pdf" \
  --output output.pdf
```

### Other endpoints

- `GET /api/v1/health` - Health check
- `GET /api/v1/formats` - List supported formats

## Using in Node.js

```javascript
import { convert } from '@jabezpauls/md-converter';
import { writeFile } from 'fs/promises';

const markdown = '# Hello World\n\nThis is **bold** text.';
const buffer = await convert(markdown, 'docx');

await writeFile('output.docx', buffer);
```

## Troubleshooting

**PDF conversion fails with "Chrome not found"**

The converter needs Chrome or Chromium to generate PDFs. Install it via your package manager:

```bash
# Ubuntu/Debian
sudo apt install chromium-browser

# Arch Linux
sudo pacman -S chromium

# macOS
brew install --cask google-chrome
```

If Chrome is installed in a non-standard location, set the path:

```bash
export CHROME_PATH=/path/to/chrome
md-converter document.md -f pdf
```

**Permission errors on Linux**

Some Linux distributions need additional dependencies for Chrome to run in headless mode:

```bash
sudo apt-get install -y libgbm1 libasound2 libatk-bridge2.0-0 libgtk-3-0 libnss3
```

## Development

```bash
git clone https://github.com/jabezpauls/md-converter.git
cd md-converter
npm install
npm run build
```

Run the CLI locally:

```bash
node dist/cli/index.js document.md -f pdf
```

## License

MIT

## Links

- Repository: https://github.com/jabezpauls/md-converter
- Issues: https://github.com/jabezpauls/md-converter/issues
- npm: https://www.npmjs.com/package/@jabezpauls/md-converter
