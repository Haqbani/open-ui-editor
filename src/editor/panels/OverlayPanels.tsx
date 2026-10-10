import { EditorFocusScope } from "@react-email/editor/ui";
import type { Editor } from "@tiptap/core";
import { motion } from "motion/react";
import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "../shell/icons";
import { GlobalCssPanel } from "./GlobalCssPanel";
import { ThemePanel } from "./ThemePanel";

type OverlayState = {
  kind: "theme" | "css";
  group?: string;
  key: number;
} | null;
const OverlayContext = createContext<{
  state: OverlayState;
  open: (kind: "theme" | "css", group?: string) => void;
  close: () => void;
} | null>(null);
export const useOverlayPanels = () => useContext(OverlayContext);
export function OverlayPanelsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OverlayState>(null);
  return (
    <OverlayContext.Provider
      value={{
        state,
        open: (kind, group) =>
          setState((old) => ({ kind, group, key: (old?.key ?? 0) + 1 })),
        close: () => setState(null),
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
}
export function OverlayPanels({ editor }: { editor: Editor | null }) {
  const overlay = useOverlayPanels();
  const wasOpen = useRef(false);
  useLayoutEffect(() => {
    if (overlay?.state) {
      document
        .querySelector<HTMLElement>(
          `[data-testid="${overlay.state.kind}-sidebar"] .overlay-focus-scope`,
        )
        ?.focus({ preventScroll: true });
    } else if (wasOpen.current) {
      document
        .querySelector<HTMLElement>('[data-testid="editor-inspector"]')
        ?.focus({ preventScroll: true });
    }
    wasOpen.current = !!overlay?.state;
  }, [overlay?.state]);
  if (!editor || !overlay) return null;
  return (
    <>
      {(["theme", "css"] as const).map((kind) => {
        const open = overlay.state?.kind === kind;
        return (
          <motion.aside
            key={kind}
            className={`editor-overlay ${kind}-overlay`}
            data-testid={`${kind}-sidebar`}
            aria-label={kind === "theme" ? "Theme" : "Global CSS"}
            inert={!open}
            aria-hidden={!open}
            initial={{
              x: -20,
              y: 4,
              opacity: 0,
              scale: 1.02,
              width: kind === "css" ? 316 : 320,
            }}
            animate={{
              x: -24,
              y: 0,
              opacity: open ? 1 : 0,
              scale: open ? 1 : 1.02,
              width: kind === "css" ? (open ? 500 : 316) : 320,
            }}
            transition={{
              type: "spring",
              bounce: 0,
              duration: 0.35,
              delay: open ? 0.1 : 0,
              opacity: { type: "tween", duration: 0.1, delay: open ? 0.1 : 0 },
            }}
            style={{ pointerEvents: open ? "auto" : "none" }}
          >
            <EditorFocusScope>
              <div className="overlay-focus-scope" tabIndex={-1}>
                <header>
                  <Icon
                    name={kind === "theme" ? "Theme options" : "CSS braces"}
                    size={16}
                  />
                  <h2>{kind === "theme" ? "Theme" : "Global CSS"}</h2>
                  <button
                    type="button"
                    aria-label="Close sidebar"
                    onClick={overlay.close}
                  >
                    <Icon name="Clear color" />
                  </button>
                </header>
                {kind === "theme" ? (
                  <ThemePanel
                    editor={editor}
                    request={open ? overlay.state : null}
                  />
                ) : (
                  <GlobalCssPanel editor={editor} />
                )}
              </div>
            </EditorFocusScope>
          </motion.aside>
        );
      })}
    </>
  );
}
