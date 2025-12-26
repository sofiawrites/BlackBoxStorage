import { bytesToHex } from './bytes';

function base58Encode(bytes: Uint8Array): string {
  const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let value = 0n;
  for (const b of bytes) value = value * 256n + BigInt(b);

  let encoded = '';
  while (value > 0n) {
    const mod = value % 58n;
    encoded = alphabet[Number(mod)] + encoded;
    value /= 58n;
  }

  for (let i = 0; i < bytes.length && bytes[i] === 0; i++) encoded = '1' + encoded;
  return encoded || '1';
}

export async function computeCidV0FromFile(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  const multihash = new Uint8Array(2 + digest.length);
  multihash[0] = 0x12; // sha2-256
  multihash[1] = 0x20; // 32 bytes
  multihash.set(digest, 2);
  return base58Encode(multihash);
}

export function describeFile(file: File): string {
  const sizeKb = (file.size / 1024).toFixed(file.size < 1024 * 10 ? 1 : 0);
  return `${file.name} (${sizeKb} KB)`;
}

export function debugMultihashHex(cidV0: string): string {
  try {
    // This is only for debugging display; not a decoder.
    return `${cidV0.slice(0, 6)}…`;
  } catch {
    return bytesToHex(new Uint8Array());
  }
}

