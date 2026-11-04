export const limit = (text: string, max: number) => (text.length > max ? text.slice(0, max) : text);

export function messageOf(error: unknown) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}
