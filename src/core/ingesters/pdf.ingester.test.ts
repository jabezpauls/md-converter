import { describe, it, expect } from 'vitest';
import {
  itemsToLines,
  linesToMarkdown,
  stripHeadersAndFooters,
  type ExtractedItem,
  type ExtractedLine,
} from './pdf.ingester.js';

/** Build a synthetic text run. Width defaults to ~0.5em per character. */
function item(
  str: string,
  x: number,
  y: number,
  fontSize = 12,
  width?: number
): ExtractedItem {
  const w = width ?? str.length * fontSize * 0.5;
  return {
    str,
    x,
    y,
    width: w,
    height: fontSize,
    fontSize,
    hasEOL: false,
  };
}

describe('itemsToLines — space insertion (issue #3)', () => {
  it('inserts spaces between adjacent word runs using x-gaps', () => {
    // Arrange: justified-style runs with no embedded spaces
    const items = [
      item('specifically', 72, 500, 12, 70),
      item('for', 150, 500, 12, 18),
      item('e-commerce', 176, 500, 12, 60),
      item('websites', 244, 500, 12, 48),
      item('specializing', 300, 500, 12, 70),
      item('in', 378, 500, 12, 12),
      item('stock', 398, 500, 12, 30),
      item('photography.', 436, 500, 12, 66),
    ];

    // Act
    const lines = itemsToLines(items);

    // Assert
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe(
      'specifically for e-commerce websites specializing in stock photography.'
    );
  });

  it('does not insert spaces between tightly packed glyph runs', () => {
    // Arrange: character-level runs of a single word (tiny gaps)
    const glyphs = ['H', 'e', 'l', 'l', 'o'];
    let x = 72;
    const items = glyphs.map((g) => {
      const it = item(g, x, 400, 12, 6);
      x += 6.2; // sub-space gap
      return it;
    });

    // Act
    const lines = itemsToLines(items);

    // Assert
    expect(lines[0].text).toBe('Hello');
  });

  it('preserves spaces already present in runs', () => {
    // Arrange
    const items = [
      item('Hello ', 72, 300, 12, 40),
      item('world', 112, 300, 12, 30),
    ];

    // Act
    const lines = itemsToLines(items);

    // Assert
    expect(lines[0].text).toBe('Hello world');
  });
});

describe('linesToMarkdown — paragraph joining (issue #3)', () => {
  it('joins wrapped paragraph lines instead of blank-lining each one', () => {
    // Arrange: body lines with ~1.5× font-height leading (typical PDF wrap)
    const lines: ExtractedLine[] = [
      {
        y: 600,
        x: 72,
        text: 'With the exponential growth of online commerce, platforms facilitating the purchase and',
        fontSize: 12,
        height: 12,
      },
      {
        y: 582,
        x: 72,
        text: 'sale of digital assets, such as stock photos, have become prime targets for cyber threats.',
        fontSize: 12,
        height: 12,
      },
      {
        y: 564,
        x: 72,
        text: 'The "Online Stock Photo E-commerce Website" project, codenamed SecureSnap,',
        fontSize: 12,
        height: 12,
      },
      {
        y: 546,
        x: 72,
        text: 'addresses this pressing issue by developing a robust cybersecurity framework.',
        fontSize: 12,
        height: 12,
      },
    ];

    // Act
    const md = linesToMarkdown(lines);

    // Assert: single paragraph, no double newlines mid-sentence
    expect(md).not.toMatch(/purchase and\n\nsale/);
    expect(md).toContain(
      'purchase and sale of digital assets, such as stock photos, have become prime targets'
    );
    expect(md).toContain(
      'codenamed SecureSnap, addresses this pressing issue by developing a robust'
    );
    expect(md.split('\n\n')).toHaveLength(1);
  });

  it('de-hyphenates words split across line wraps', () => {
    // Arrange
    const lines: ExtractedLine[] = [
      {
        y: 400,
        x: 72,
        text: 'By adopting state-of-',
        fontSize: 12,
        height: 12,
      },
      {
        y: 382,
        x: 72,
        text: 'the-art technologies and adhering to rigorous security practices',
        fontSize: 12,
        height: 12,
      },
    ];

    // Act
    const md = linesToMarkdown(lines);

    // Assert
    expect(md).toContain('state-of-the-art technologies');
    expect(md).not.toContain('state-of- the-art');
  });

  it('starts a new paragraph when vertical gap is large', () => {
    // Arrange
    const lines: ExtractedLine[] = [
      {
        y: 500,
        x: 72,
        text: 'First paragraph stays together on one line.',
        fontSize: 12,
        height: 12,
      },
      {
        y: 450, // gap 50 > 12 * 1.75
        x: 72,
        text: 'Second paragraph after a real break.',
        fontSize: 12,
        height: 12,
      },
    ];

    // Act
    const md = linesToMarkdown(lines);

    // Assert
    expect(md).toBe(
      'First paragraph stays together on one line.\n\nSecond paragraph after a real break.'
    );
  });
});

describe('linesToMarkdown — headings and lists (issue #3)', () => {
  it('promotes larger fonts and section labels to markdown headings', () => {
    // Arrange: mimics SecureSnap-style document
    const lines: ExtractedLine[] = [
      { y: 780, x: 72, text: 'Title:', fontSize: 12, height: 12 },
      {
        y: 750,
        x: 72,
        text: 'SecureSnap: A Cybersecurity Framework for Online Stock Photo E-commerce Platforms',
        fontSize: 12,
        height: 12,
      },
      { y: 700, x: 72, text: 'Abstract:', fontSize: 12, height: 12 },
      {
        y: 670,
        x: 72,
        text: 'With the exponential growth of online commerce.',
        fontSize: 12,
        height: 12,
      },
      { y: 620, x: 72, text: 'Methodology:', fontSize: 12, height: 12 },
      {
        y: 590,
        x: 72,
        text: 'Threat Modeling: Identify potential security threats.',
        fontSize: 12,
        height: 12,
      },
    ];

    // Act
    const md = linesToMarkdown(lines);

    // Assert
    expect(md).toContain(
      '# SecureSnap: A Cybersecurity Framework for Online Stock Photo E-commerce Platforms'
    );
    expect(md).toContain('## Abstract');
    expect(md).toContain('## Methodology');
    expect(md).not.toContain('Title:');
    expect(md).toContain('- **Threat Modeling:** Identify potential security threats.');
  });

  it('detects headings via font-size heuristics', () => {
    // Arrange
    const lines: ExtractedLine[] = [
      { y: 700, x: 72, text: 'SecureSnap Overview', fontSize: 24, height: 24 },
      { y: 650, x: 72, text: 'Abstract', fontSize: 18, height: 18 },
      {
        y: 620,
        x: 72,
        text: 'Body copy at the normal size for this page.',
        fontSize: 12,
        height: 12,
      },
    ];

    // Act
    const md = linesToMarkdown(lines);

    // Assert
    expect(md).toContain('# SecureSnap Overview');
    expect(md).toContain('## Abstract');
    expect(md).toContain('Body copy at the normal size for this page.');
  });

  it('formats Technology-style key-value rows as markdown lists', () => {
    // Arrange
    const lines: ExtractedLine[] = [
      { y: 500, x: 72, text: 'Technology:', fontSize: 12, height: 12 },
      {
        y: 470,
        x: 96,
        text: 'Programming Languages: HTML, CSS, JavaScript, Python',
        fontSize: 12,
        height: 12,
      },
      {
        y: 440,
        x: 96,
        text: 'Frameworks: Django, Bootstrap',
        fontSize: 12,
        height: 12,
      },
      {
        y: 410,
        x: 96,
        text: 'Database: PostgreSQL',
        fontSize: 12,
        height: 12,
      },
    ];

    // Act
    const md = linesToMarkdown(lines);

    // Assert
    expect(md).toContain('## Technology');
    expect(md).toContain('- **Programming Languages:** HTML, CSS, JavaScript, Python');
    expect(md).toContain('- **Frameworks:** Django, Bootstrap');
    expect(md).toContain('- **Database:** PostgreSQL');
  });
});

describe('stripHeadersAndFooters (issue #3)', () => {
  it('removes repeated contact chrome across pages', () => {
    // Arrange
    const chrome =
      'www.innovateintern.com | hello@innovateintern.com | (+91) 970-970-3085';
    const pages: ExtractedLine[][] = [
      [
        { y: 800, x: 72, text: chrome, fontSize: 9, height: 9 },
        { y: 760, x: 72, text: 'Title:', fontSize: 12, height: 12 },
        {
          y: 730,
          x: 72,
          text: 'SecureSnap: A Cybersecurity Framework',
          fontSize: 12,
          height: 12,
        },
      ],
      [
        { y: 800, x: 72, text: chrome, fontSize: 9, height: 9 },
        { y: 760, x: 72, text: 'Technology:', fontSize: 12, height: 12 },
        {
          y: 730,
          x: 72,
          text: 'Programming Languages: HTML, CSS, JavaScript, Python',
          fontSize: 12,
          height: 12,
        },
      ],
    ];

    // Act
    const cleaned = stripHeadersAndFooters(pages);
    const md = cleaned.map(linesToMarkdown).join('\n\n---\n\n');

    // Assert
    expect(md).not.toContain('www.innovateintern.com');
    expect(md).not.toContain('hello@innovateintern.com');
    expect(md).not.toContain('970-970-3085');
    expect(md).toContain('# SecureSnap: A Cybersecurity Framework');
    expect(md).toContain('## Technology');
  });

  it('strips chrome glued onto a section label on the same line', () => {
    // Arrange
    const pages: ExtractedLine[][] = [
      [
        {
          y: 800,
          x: 72,
          text: 'www.innovateintern.com | hello@innovateintern.com | (+91) 970-970-3085 Title:',
          fontSize: 10,
          height: 10,
        },
        {
          y: 770,
          x: 72,
          text: 'SecureSnap: A Cybersecurity Framework',
          fontSize: 12,
          height: 12,
        },
      ],
    ];

    // Act
    const cleaned = stripHeadersAndFooters(pages);
    const md = linesToMarkdown(cleaned[0]);

    // Assert
    expect(md).not.toContain('www.innovateintern.com');
    expect(md).toContain('# SecureSnap: A Cybersecurity Framework');
  });
});

describe('end-to-end SecureSnap-like page (issue #3)', () => {
  it('produces readable structured markdown from raw geometry', () => {
    // Arrange: multi-run lines simulating the broken output described in #3
    const header =
      'www.innovateintern.com | hello@innovateintern.com | (+91) 970-970-3085';

    const page1Items: ExtractedItem[] = [
      item(header, 72, 800, 9, 400),
      item('Title:', 72, 770, 12, 30),
      item('SecureSnap: A Cybersecurity Framework for Online Stock Photo E-commerce Platforms', 72, 740, 12, 480),
      item('Abstract:', 72, 700, 12, 50),
      // Paragraph line 1 as separate word runs (concat bug)
      item('With', 72, 670, 12, 28),
      item('the', 105, 670, 12, 18),
      item('exponential', 130, 670, 12, 70),
      item('growth', 208, 670, 12, 40),
      item('of', 256, 670, 12, 14),
      item('online', 278, 670, 12, 36),
      item('commerce,', 322, 670, 12, 58),
      // Paragraph line 2
      item('platforms', 72, 652, 12, 55),
      item('facilitating', 135, 652, 12, 65),
      item('the', 208, 652, 12, 18),
      item('purchase', 234, 652, 12, 50),
      item('and', 292, 652, 12, 22),
      item('sale', 322, 652, 12, 24),
      item('of', 354, 652, 12, 14),
      item('digital', 376, 652, 12, 40),
      item('assets.', 424, 652, 12, 40),
      item('Methodology:', 72, 600, 12, 80),
      item('Threat Modeling: Identify potential security threats.', 96, 570, 12, 300),
      item('Security Requirements Analysis: Define security requirements.', 96, 540, 12, 360),
    ];

    const page2Items: ExtractedItem[] = [
      item(header, 72, 800, 9, 400),
      item('Technology:', 72, 760, 12, 70),
      item('Programming Languages: HTML, CSS, JavaScript, Python', 96, 730, 12, 320),
      item('Frameworks: Django, Bootstrap', 96, 700, 12, 200),
      item('Database: PostgreSQL', 96, 670, 12, 140),
      item('Outcome:', 72, 620, 12, 55),
      item('The SecureSnap project aims to revolutionize security.', 72, 590, 12, 340),
    ];

    // Act
    const pages = stripHeadersAndFooters([
      itemsToLines(page1Items),
      itemsToLines(page2Items),
    ]);
    const md = pages.map(linesToMarkdown).filter(Boolean).join('\n\n---\n\n') + '\n';

    // Assert — mirrors expected output from issue #3
    expect(md).not.toContain('www.innovateintern.com');
    expect(md).toContain(
      '# SecureSnap: A Cybersecurity Framework for Online Stock Photo E-commerce Platforms'
    );
    expect(md).toContain('## Abstract');
    expect(md).toMatch(/With the exponential growth of online commerce, platforms facilitating/);
    expect(md).not.toMatch(/commerce,\n\nplatforms/);
    expect(md).toContain('## Methodology');
    expect(md).toContain('- **Threat Modeling:** Identify potential security threats.');
    expect(md).toContain('- **Security Requirements Analysis:** Define security requirements.');
    expect(md).toContain('## Technology');
    expect(md).toContain('- **Programming Languages:** HTML, CSS, JavaScript, Python');
    expect(md).toContain('- **Frameworks:** Django, Bootstrap');
    expect(md).toContain('- **Database:** PostgreSQL');
    expect(md).toContain('## Outcome');
    expect(md).toContain('The SecureSnap project aims to revolutionize security.');
  });
});
