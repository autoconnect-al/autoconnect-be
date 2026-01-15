import { BadRequestException } from '@nestjs/common';

export function normalizeGeneralSearch(input?: string): string[] {
  if (!input) return [];

  const cleaned = input.replace(/,/g, ' ').toLowerCase();
  if (cleaned.length > 75) {
    throw new BadRequestException('General search too long');
  }

  let tokens = cleaned.split(/\s+/).slice(0, 10);

  tokens = tokens.map(t => {
    if (t === 'benc') return 'benz';
    if (t === 'mercedez') return 'mercedes';
    if (['seri', 'seria', 'serija'].includes(t)) return 'series';
    if (['klas', 'klasa', 'clas'].includes(t)) return 'class';
    return t;
  });

  // T Max → Tmax
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] === 't' && tokens[i + 1] === 'max') {
      tokens[i] = 'tmax';
      tokens.splice(i + 1, 1);
    }
  }

  // series swap
  for (let i = 0; i < tokens.length - 2; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    const c = tokens[i + 2];

    const isBMW =
      a === 'bmw' || c === 'bmw';

    const isSeriesPattern =
      (b === 'series' && /^\d+$/.test(c)) ||
      (/^\d+$/.test(b) && c === 'series');

    if (isBMW && isSeriesPattern) {
      const seriesNumber = /^\d+$/.test(b) ? b : c;

      tokens.splice(i, 3, `${seriesNumber}-series`);
      break;
    }
  }

  // single-char merge
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].length === 1 && !/^\d+$/.test(tokens[i])) {
      tokens[i] = /^\d+$/.test(tokens[i + 1])
        ? `${tokens[i]} ${tokens[i + 1]}`
        : `${tokens[i]}-${tokens[i + 1]}`;
      tokens.splice(i + 1, 1);
    }
  }

  // merge model numbers
  for (let i = 1; i < tokens.length; i++) {
    if (/^\d+$/.test(tokens[i]) && !tokens[i - 1].includes('-')) {
      tokens[i - 1] =
        tokens[i - 1] === 'golf'
          ? `${tokens[i - 1]} ${tokens[i]}`
          : `${tokens[i - 1]}-${tokens[i]}`;
      tokens.splice(i, 1);
      i--;
    }
  }

  return tokens;
}
