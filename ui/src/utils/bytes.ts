export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  const hex: string[] = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) hex[i] = bytes[i].toString(16).padStart(2, '0');
  return `0x${hex.join('')}`;
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (normalized.length % 2 !== 0) throw new Error('Invalid hex string');
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

