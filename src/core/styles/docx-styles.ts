import {
  HeadingLevel,
  convertInchesToTwip,
  UnderlineType,
} from 'docx';

// Orange color for headings
export const HEADING_COLOR = 'E67E22';

export const docxStyles = {
  paragraphStyles: [
    {
      id: 'Heading1',
      name: 'Heading 1',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: {
        size: 64, // 32pt * 2
        bold: true,
        color: HEADING_COLOR,
        font: 'Calibri Light',
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.25),
          after: convertInchesToTwip(0.1),
        },
      },
    },
    {
      id: 'Heading2',
      name: 'Heading 2',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: {
        size: 52, // 26pt * 2
        bold: true,
        color: HEADING_COLOR,
        font: 'Calibri Light',
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.2),
          after: convertInchesToTwip(0.08),
        },
      },
    },
    {
      id: 'Heading3',
      name: 'Heading 3',
      basedOn: 'Normal',
      next: 'Normal',
      quickFormat: true,
      run: {
        size: 44, // 22pt * 2
        bold: true,
        color: HEADING_COLOR,
        font: 'Calibri Light',
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.15),
          after: convertInchesToTwip(0.06),
        },
      },
    },
    {
      id: 'BodyText',
      name: 'Body Text',
      basedOn: 'Normal',
      next: 'BodyText',
      quickFormat: true,
      run: {
        size: 24, // 12pt * 2
        font: 'Calibri',
      },
      paragraph: {
        spacing: {
          after: convertInchesToTwip(0.1),
          line: 276, // 1.15 line spacing
        },
      },
    },
    {
      id: 'CodeBlock',
      name: 'Code Block',
      basedOn: 'Normal',
      quickFormat: true,
      run: {
        size: 20, // 10pt * 2
        font: 'Consolas',
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.1),
          after: convertInchesToTwip(0.1),
        },
        shading: {
          fill: 'F5F5F5',
        },
      },
    },
    {
      id: 'ListParagraph',
      name: 'List Paragraph',
      basedOn: 'Normal',
      quickFormat: true,
      run: {
        size: 24,
        font: 'Calibri',
      },
      paragraph: {
        spacing: {
          after: convertInchesToTwip(0.05),
        },
      },
    },
    {
      id: 'Quote',
      name: 'Quote',
      basedOn: 'Normal',
      quickFormat: true,
      run: {
        size: 24,
        font: 'Calibri',
        italics: true,
        color: '666666',
      },
      paragraph: {
        spacing: {
          before: convertInchesToTwip(0.1),
          after: convertInchesToTwip(0.1),
        },
        indent: {
          left: convertInchesToTwip(0.5),
        },
        border: {
          left: {
            color: HEADING_COLOR,
            size: 24,
            style: 'single' as const,
          },
        },
      },
    },
  ],
  characterStyles: [
    {
      id: 'InlineCode',
      name: 'Inline Code',
      basedOn: 'DefaultParagraphFont',
      run: {
        font: 'Consolas',
        size: 22,
        shading: {
          fill: 'F5F5F5',
        },
      },
    },
    {
      id: 'Hyperlink',
      name: 'Hyperlink',
      basedOn: 'DefaultParagraphFont',
      run: {
        color: '0066CC',
        underline: {
          type: UnderlineType.SINGLE,
        },
      },
    },
  ],
};

export const headingLevelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
};
