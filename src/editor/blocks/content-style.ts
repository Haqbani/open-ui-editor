import type { CSSProperties } from "react";
export function inlineCss(raw: unknown): CSSProperties {
  return Object.fromEntries(
    String(raw ?? "")
      .split(";")
      .filter((s) => s.includes(":"))
      .map((s) => {
        const at = s.indexOf(":");
        return [
          s
            .slice(0, at)
            .trim()
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()),
          s.slice(at + 1).trim(),
        ];
      }),
  );
}
