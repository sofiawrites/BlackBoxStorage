import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from './bytes';

function addressToBytes(address: string): Uint8Array {
  const normalized = address.toLowerCase().replace(/^0x/, '');
  if (normalized.length !== 40) throw new Error('Invalid address length');
  const bytes = new Uint8Array(20);
  for (let i = 0; i < 20; i++) bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function deriveKeyFromAddress(address: string): Promise<CryptoKey> {
  const addressBytes = addressToBytes(address);
  const keyBytes = new Uint8Array(await crypto.subtle.digest('SHA-256', addressBytes));
  return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptUtf8WithAddress(address: string, plaintext: string): Promise<`0x${string}`> {
  const key = await deriveKeyFromAddress(address);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = utf8ToBytes(plaintext);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
  const payload = new Uint8Array(1 + iv.length + encrypted.length);
  payload[0] = 0x01; // version
  payload.set(iv, 1);
  payload.set(encrypted, 1 + iv.length);
  return bytesToHex(payload);
}

export async function decryptUtf8WithAddress(address: string, encryptedHex: string): Promise<string> {
  const payload = hexToBytes(encryptedHex);
  if (payload.length < 1 + 12 + 16) throw new Error('Invalid encrypted payload');
  if (payload[0] !== 0x01) throw new Error('Unsupported payload version');
  const iv = payload.slice(1, 13);
  const encrypted = payload.slice(13);
  const key = await deriveKeyFromAddress(address);
  const decrypted = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted));
  return bytesToUtf8(decrypted);
}

export function normalizeDecryptedAddress(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Unexpected decrypted value type');
  const trimmed = value.trim();

  if (trimmed.startsWith('0x') && trimmed.length === 42) return trimmed;

  if (/^\d+$/.test(trimmed)) {
    const big = BigInt(trimmed);
    const hex = big.toString(16).padStart(40, '0');
    return `0x${hex}`;
  }

  if (/^[0-9a-fA-F]{40}$/.test(trimmed)) return `0x${trimmed}`;

  throw new Error(`Unrecognized decrypted address format: ${trimmed}`);
}

