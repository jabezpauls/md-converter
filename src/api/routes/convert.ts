import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { converter } from '../../core/converter.js';
import { FORMAT_INFO, type OutputFormat } from '../../types/index.js';

// The JSON API converts Markdown text -> X only; 'md' output needs a binary input
// and so is not offered here.
type ForwardFormat = Exclude<OutputFormat, 'md'>;

interface ConvertJsonBody {
  markdown: string;
  format: ForwardFormat;
  options?: {
    syntaxHighlight?: boolean;
    pageSize?: 'A4' | 'Letter';
  };
}

const validFormats = ['docx', 'pdf', 'txt', 'html'] as const;

function isValidFormat(format: string): format is ForwardFormat {
  return validFormats.includes(format as ForwardFormat);
}

export async function convertRoutes(fastify: FastifyInstance): Promise<void> {
  // JSON body endpoint
  fastify.post<{ Body: ConvertJsonBody }>(
    '/convert',
    {
      schema: {
        body: {
          type: 'object',
          required: ['markdown', 'format'],
          properties: {
            markdown: { type: 'string' },
            format: { type: 'string', enum: validFormats },
            options: {
              type: 'object',
              properties: {
                syntaxHighlight: { type: 'boolean' },
                pageSize: { type: 'string', enum: ['A4', 'Letter'] },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { markdown, format, options = {} } = request.body;

      if (!isValidFormat(format)) {
        return reply.status(400).send({
          error: 'Invalid format',
          code: 'INVALID_FORMAT',
          details: `Format must be one of: ${validFormats.join(', ')}`,
        });
      }

      try {
        const buffer = await converter.convert(markdown, {
          format,
          syntaxHighlight: options.syntaxHighlight ?? true,
          pageSize: options.pageSize ?? 'A4',
        });

        const formatInfo = FORMAT_INFO[format];

        return reply
          .header('Content-Type', formatInfo.mimeType)
          .header(
            'Content-Disposition',
            `attachment; filename="output${formatInfo.extension}"`
          )
          .send(buffer);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Conversion failed',
          code: 'CONVERSION_ERROR',
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // Multipart file upload endpoint
  fastify.post('/convert/file', async (request: FastifyRequest, reply: FastifyReply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({
        error: 'No file uploaded',
        code: 'NO_FILE',
        details: 'Please upload a markdown file',
      });
    }

    const format = (data.fields.format as { value: string } | undefined)?.value;
    const syntaxHighlightField = (data.fields.syntaxHighlight as { value: string } | undefined)?.value;
    const pageSizeField = (data.fields.pageSize as { value: string } | undefined)?.value;

    if (!format || !isValidFormat(format)) {
      return reply.status(400).send({
        error: 'Invalid or missing format',
        code: 'INVALID_FORMAT',
        details: `Format must be one of: ${validFormats.join(', ')}`,
      });
    }

    try {
      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const markdown = Buffer.concat(chunks).toString('utf-8');

      const buffer = await converter.convert(markdown, {
        format,
        syntaxHighlight: syntaxHighlightField !== 'false',
        pageSize: (pageSizeField as 'A4' | 'Letter') ?? 'A4',
      });

      const formatInfo = FORMAT_INFO[format];
      const originalName = data.filename.replace(/\.[^/.]+$/, '');

      return reply
        .header('Content-Type', formatInfo.mimeType)
        .header(
          'Content-Disposition',
          `attachment; filename="${originalName}${formatInfo.extension}"`
        )
        .send(buffer);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Conversion failed',
        code: 'CONVERSION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
