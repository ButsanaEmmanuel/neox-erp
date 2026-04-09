import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const SCRYPT_KEY_LEN = 64;

export function generateTemporaryPassword(length = 14): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(length);
  let output = '';
  for (let i = 0; i < length; i += 1) {
    output += alphabet[bytes[i] % alphabet.length];
  }
  return output;
}

export function hashPassword(plainTextPassword: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(plainTextPassword, salt, SCRYPT_KEY_LEN).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(plainTextPassword: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const check = scryptSync(plainTextPassword, salt, SCRYPT_KEY_LEN);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === check.length && timingSafeEqual(expected, check);
}
