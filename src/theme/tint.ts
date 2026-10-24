/** A soft wash of a theme color. Screens stay on tokens; this only adds alpha. */
export function tint(color: string, alpha: number): string {
  const raw = color.trim().replace('#', '');
  const value = raw.length === 3 ? raw.split('').map(channel => channel + channel).join('') : raw;
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return color;
  }
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const amount = Math.max(0, Math.min(1, alpha));
  return `rgba(${red},${green},${blue},${amount})`;
}
