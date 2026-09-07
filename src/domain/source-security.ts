const FORMAT_OR_LINE_SEPARATOR = /[\p{Cf}\p{Zl}\p{Zp}]/u;
const CONTROL = /\p{Cc}/u;

export function hasUnsafeSourceCharacters(content: string): boolean {
  for (const character of content) {
    if (
      FORMAT_OR_LINE_SEPARATOR.test(character) ||
      (CONTROL.test(character) && !["\n", "\r", "\t"].includes(character))
    )
      return true;
  }
  return false;
}

export function isClipboardShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return (
    (event.ctrlKey || event.metaKey) &&
    ["c", "v", "x"].includes(event.key.toLowerCase())
  );
}
