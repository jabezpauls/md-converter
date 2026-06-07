import { Command } from 'commander';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { convertCommand } from './commands/convert.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

const program = new Command();

program
  .name('md-converter')
  .description('Convert Markdown to DOCX/PDF/TXT/HTML, or PDF/DOCX back to Markdown')
  .version(packageJson.version);

program
  .argument('<input>', 'Input file (.md, or .pdf/.docx when -f md)')
  .requiredOption('-f, --format <format>', 'Output format: docx, pdf, txt, html, md')
  .option('-o, --output <path>', 'Output file path')
  .option('--no-syntax-highlight', 'Disable code syntax highlighting')
  .option('--page-size <size>', 'PDF page size: A4 or Letter', 'A4')
  .option('-v, --verbose', 'Verbose output')
  .action(convertCommand);

program.parse();
