export const MONOGRAM_SWATCHES = [
  { fill: '#A93F55', ink: '#FFFFFF' },
  { fill: '#4F6F57', ink: '#FFFFFF' },
  { fill: '#8A6A22', ink: '#FFFFFF' },
  { fill: '#5D7290', ink: '#FFFFFF' },
  { fill: '#6E4A6B', ink: '#FFFFFF' },
] as const;

export function monogramIndex(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (Math.imul(hash, 31) + id.charCodeAt(index)) >>> 0;
  }
  return hash % MONOGRAM_SWATCHES.length;
}

export function monogramLetters(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}
