import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile, rm, mkdtemp, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const run = promisify(execFile);
const CLI = resolve('dist/cli/index.js');

const SAMPLE = `# CLI Test

Some **bold** text.
`;

// These tests drive the compiled CLI, so the build must exist first.
async function ensureBuilt() {
  try {
    await access(CLI);
  } catch {
    await run('npm', ['run', 'build']);
  }
}

describe('CLI', () => {
  let dir: string;
  let mdInput: string;

  beforeAll(async () => {
    await ensureBuilt();
    dir = await mkdtemp(join(tmpdir(), 'mdc-cli-'));
    mdInput = join(dir, 'doc.md');
    await writeFile(mdInput, SAMPLE);
  }, 60_000);

  it('converts markdown to html', async () => {
    // Arrange
    const out = join(dir, 'doc.html');

    // Act
    await run('node', [CLI, mdInput, '-f', 'html', '-o', out]);

    // Assert
    const html = await readFile(out, 'utf-8');
    expect(html).toContain('CLI Test');
  });

  it('converts markdown to txt', async () => {
    // Arrange
    const out = join(dir, 'doc.txt');

    // Act
    await run('node', [CLI, mdInput, '-f', 'txt', '-o', out]);

    // Assert
    expect(await readFile(out, 'utf-8')).toContain('CLI Test');
  });

  it('round-trips markdown -> docx -> markdown', async () => {
    // Arrange
    const docx = join(dir, 'doc.docx');
    const md = join(dir, 'back.md');

    // Act
    await run('node', [CLI, mdInput, '-f', 'docx', '-o', docx]);
    await run('node', [CLI, docx, '-f', 'md', '-o', md]);

    // Assert
    expect(await readFile(md, 'utf-8')).toContain('# CLI Test');
  });

  it('exits non-zero on an invalid format', async () => {
    // Arrange / Act / Assert
    await expect(run('node', [CLI, mdInput, '-f', 'xml'])).rejects.toMatchObject({
      code: 1,
    });
  });

  it('exits non-zero when converting an unsupported source to md', async () => {
    // Arrange
    const txt = join(dir, 'plain.txt');
    await writeFile(txt, 'hello');

    // Act / Assert
    await expect(run('node', [CLI, txt, '-f', 'md'])).rejects.toMatchObject({
      code: 1,
    });
  });

  it('exits non-zero on a missing input file', async () => {
    // Arrange / Act / Assert
    await expect(
      run('node', [CLI, join(dir, 'nope.md'), '-f', 'html'])
    ).rejects.toMatchObject({ code: 1 });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });
});
