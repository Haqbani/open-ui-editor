import type { ReactNode } from "react";
export function PaletteFrame({ children }: { children: ReactNode }) {
  return (
    <nav
      data-testid="insertion-palette"
      aria-label="Insert content"
      className="palette-frame"
    >
      {children}
    </nav>
  );
}
