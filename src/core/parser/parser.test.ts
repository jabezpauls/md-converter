import { describe, it, expect } from 'vitest';
import { MarkdownParser } from './index.js';

describe('MarkdownParser', () => {
  const parser = new MarkdownParser();

  it('parses a heading into an mdast heading node', () => {
    // Arrange
    const markdown = '# Title';

    // Act
    const { mdast } = parser.parse(markdown);

    // Assert
    expect(mdast.type).toBe('root');
    expect(mdast.children[0]).toMatchObject({ type: 'heading', depth: 1 });
  });

  it('parses GFM tables by default', () => {
    // Arrange
    const markdown = '| a | b |\n| --- | --- |\n| 1 | 2 |';

    // Act
    const { mdast } = parser.parse(markdown);

    // Assert
    expect(mdast.children.some((n) => n.type === 'table')).toBe(true);
  });

  it('does not parse tables when gfm is disabled', () => {
    // Arrange
    const markdown = '| a | b |\n| --- | --- |\n| 1 | 2 |';

    // Act
    const { mdast } = parser.parse(markdown, { gfm: false });

    // Assert
    expect(mdast.children.some((n) => n.type === 'table')).toBe(false);
  });
});
