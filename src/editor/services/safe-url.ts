export function isSafeUrl(value: string) {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: deployed URL safety strips control characters before protocol checks.
  const stripped = value.replace(/[\s\u0000-\u001F\u007F]/g, "");
  if (!stripped || stripped.startsWith("//")) return false;
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml)[;,]/i.test(stripped))
    return true;
  try {
    return ![
      "javascript:",
      "vbscript:",
      "data:",
      "file:",
      "blob:",
      "about:",
    ].includes(new URL(stripped).protocol.toLowerCase());
  } catch {
    return true;
  }
}
