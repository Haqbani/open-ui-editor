import { stylesToCss } from "@react-email/editor/plugins";
import type { Editor } from "@tiptap/core";
import { colord, extend } from "colord";
import namesPlugin from "colord/plugins/names";

extend([namesPlugin]);

/** Production deliberately uses hex-only luminance separately from CSS HSL parsing. */
function isDarkBody(background: string) {
  try {
    const expanded =
      background.length === 4
        ? `#${background[1]}${background[1]}${background[2]}${background[2]}${background[3]}${background[3]}`
        : background;
    const hex = expanded.replace(/^#/, "");
    const linear = [0, 2, 4].map((i) => {
      const value = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
      return value <= 0.03928
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] < 0.5;
  } catch {
    return false;
  }
}

/** Derive handle contrast from the email body independently of chrome appearance. */
export function handleColors(editor: Editor) {
  let background = "#ffffff",
    found = false;
  editor.state.doc.forEach((node) => {
    if (found || node.type.name !== "globalContent") return;
    found = true;
    const data = node.attrs.data;
    if (data?.styles && data?.theme) {
      try {
        background = String(
          stylesToCss(data.styles, data.theme).body?.backgroundColor ||
            background,
        );
      } catch {}
    }
  });
  const isDark = isDarkBody(background);
  const { h, s, l } = colord(background).toHsl();
  return {
    isDark,
    foreground: `hsl(${h}, ${s}%, ${isDark ? l + 20 : l - 20}%)`,
    foregroundHover: `hsl(${h}, ${s}%, ${isDark ? l + 40 : l - 40}%)`,
  };
}
