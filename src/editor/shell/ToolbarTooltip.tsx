import { Tooltip } from "@base-ui/react/tooltip";
import type { ReactNode } from "react";

const items = {
  bold: ["Bold", "B"],
  italic: ["Italic", "I"],
  underline: ["Underline", "U"],
  strike: ["Strikethrough", "S"],
  code: ["Code", "E"],
  link: ["Link", "K"],
  ai: ["Edit with AI", ""],
} as const;
export function ToolbarTooltip({
  of,
  disabled = false,
  children,
}: {
  of: keyof typeof items;
  disabled?: boolean;
  children: ReactNode;
}) {
  const platform =
    typeof navigator === "undefined"
      ? ""
      : `${navigator.platform} ${navigator.userAgent}`;
  const mac = !/win|linux|x11/i.test(platform) || /mac|darwin/i.test(platform);
  const [label, key] = items[of];
  const keys = key
    ? [
        mac ? "⌘" : "Ctrl",
        ...(of === "strike" ? [mac ? "⇧" : "Shift"] : []),
        key,
      ]
    : [];
  return (
    <Tooltip.Root disabled={disabled}>
      <Tooltip.Trigger render={<span className="toolbar-tooltip-trigger" />}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner
          side="bottom"
          sideOffset={6}
          className="toolbar-tooltip-positioner"
        >
          <Tooltip.Popup className="toolbar-tooltip">
            <span className="toolbar-tooltip-content">
              {label}
              {keys.length > 0 && (
                <span className="toolbar-tooltip-keys">
                  {keys.map((value) => (
                    <kbd
                      key={value}
                      className={value.length === 1 ? "single-key" : undefined}
                    >
                      {value}
                    </kbd>
                  ))}
                </span>
              )}
            </span>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
