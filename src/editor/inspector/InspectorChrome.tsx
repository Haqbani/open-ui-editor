import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

export const InspectorHeadingHost = createContext<HTMLDivElement | null>(null);

export function InspectorHeading({ children }: { children: ReactNode }) {
  const host = useContext(InspectorHeadingHost);
  return host
    ? createPortal(<div className="inspector-title">{children}</div>, host)
    : null;
}
