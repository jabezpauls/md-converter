import { Command } from 'commander';
import { convertCommand } from './commands/convert.js';

const program = new Command();

program
  .name('md-converter')
  .description('Convert Markdown to DOCX/PDF/TXT/HTML, or PDF/DOCX back to Markdown')
  .version('1.0.0');

program
  .argument('<input>', 'Input file (.md, or .pdf/.docx when -f md)')
  .requiredOption('-f, --format <format>', 'Output format: docx, pdf, txt, html, md')
  .option('-o, --output <path>', 'Output file path')
  .option('--no-syntax-highlight', 'Disable code syntax highlighting')
  .option('--page-size <size>', 'PDF page size: A4 or Letter', 'A4')
  .option('-v, --verbose', 'Verbose output')
  .action(convertCommand);

program.parse();
