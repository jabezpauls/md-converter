import { existsSync } from 'fs';
import { resolve, basename, extname, dirname, join } from 'path';
import chalk from 'chalk';
import { converter } from '../../core/converter.js';
import { FORMAT_INFO, type OutputFormat } from '../../types/index.js';
import { pdfTransformer } from '../../core/transformers/index.js';

interface ConvertCommandOptions {
  format: string;
  output?: string;
  syntaxHighlight?: boolean;
  pageSize?: string;
  verbose?: boolean;
}

const validFormats = ['docx', 'pdf', 'txt', 'html', 'md'] as const;
const validSourceExtensions = ['.pdf', '.docx'];

function isValidFormat(format: string): format is OutputFormat {
  return validFormats.includes(format as OutputFormat);
}

export async function convertCommand(
  inputPath: string,
  options: ConvertCommandOptions
): Promise<void> {
  const { format, output, syntaxHighlight = true, pageSize = 'A4', verbose = false } = options;

  // Validate format
  if (!isValidFormat(format)) {
    console.error(
      chalk.red(`Error: Invalid format "${format}". Valid formats: ${validFormats.join(', ')}`)
    );
    process.exit(1);
  }

  // Resolve input path
  const resolvedInput = resolve(inputPath);

  // Check if input file exists
  if (!existsSync(resolvedInput)) {
    console.error(chalk.red(`Error: Input file not found: ${resolvedInput}`));
    process.exit(1);
  }

  // Reverse conversion (-> Markdown) requires a supported binary source
  if (format === 'md' && !validSourceExtensions.includes(extname(resolvedInput).toLowerCase())) {
    console.error(
      chalk.red(
        `Error: Cannot convert "${extname(resolvedInput)}" to Markdown. Supported source formats: ${validSourceExtensions.join(', ')}`
      )
    );
    process.exit(1);
  }

  // Determine output path
  const formatInfo = FORMAT_INFO[format];
  const outputPath = output
    ? resolve(output)
    : join(dirname(resolvedInput), basename(resolvedInput, extname(resolvedInput)) + formatInfo.extension);

  if (verbose) {
    console.log(chalk.gray(`Input: ${resolvedInput}`));
    console.log(chalk.gray(`Output: ${outputPath}`));
    console.log(chalk.gray(`Format: ${formatInfo.name}`));
  }

  console.log(`Converting to ${formatInfo.name}...`);

  let exitCode = 0;

  try {
    await converter.convertFile(resolvedInput, outputPath, {
      format,
      syntaxHighlight,
      pageSize: pageSize as 'A4' | 'Letter',
    });

    console.log(chalk.green(`✔ Successfully converted to ${outputPath}`));
  } catch (error) {
    exitCode = 1;
    console.log(chalk.red('✖ Conversion failed'));

    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
      if (verbose && error.stack) {
        console.error(chalk.gray(error.stack));
      }
    }
  } finally {
    if (format === 'pdf') {
      await pdfTransformer.dispose();
    }
  }

  process.exit(exitCode);
}
