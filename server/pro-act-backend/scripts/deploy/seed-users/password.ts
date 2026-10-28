import { randomInt } from 'crypto';

const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SYMBOLS = '!@#%^*-_';

function pick(alphabet: string, count: number): string[] {
  return Array.from(
    { length: count },
    () => alphabet[randomInt(alphabet.length)],
  );
}

/** 20 letters/digits plus two symbols, shuffled (Fisher-Yates over crypto.randomInt). */
export function generatePassword(): string {
  const chars = [...pick(ALNUM, 20), ...pick(SYMBOLS, 2)];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
