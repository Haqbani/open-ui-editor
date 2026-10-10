import { editorEventBus } from "@react-email/editor/core";
import type { Editor } from "@tiptap/core";
import { motion } from "motion/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { handleColors } from "../blocks/handle-colors";
import { useOverlayPanels } from "../panels/OverlayPanels";

const InspectorLayout = createContext<{
  open: boolean;
  pinned: boolean;
  hideOrPin: () => void;
  hold: () => () => void;
} | null>(null);
export const useInspectorLayout = () => useContext(InspectorLayout);
export function FloatingInspectorLayer({ children }: { children: ReactNode }) {
  const layout = useInspectorLayout();
  const hold = layout?.hold;
  useEffect(() => hold?.(), [hold]);
  return children;
}
export function InspectorFrame({
  editor,
  children,
  visible = true,
}: {
  editor: Editor | null;
  children: ReactNode;
  visible?: boolean;
}) {
  const overlay = useOverlayPanels();
  const [open, setOpen] = useState(true),
    [pinned, setPinned] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inside = useRef(false),
    layers = useRef(0),
    pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const schedule = useCallback(() => {
    cancel();
    if (!pinnedRef.current && !inside.current && !layers.current)
      timer.current = setTimeout(() => setOpen(false), 300);
  }, [cancel]);
  const hold = useCallback(() => {
    layers.current++;
    cancel();
    return () => {
      layers.current--;
      schedule();
    };
  }, [cancel, schedule]);
  useEffect(() => {
    const subscription = editorEventBus.on("node-clicked", () => {
      cancel();
      setOpen(true);
    });
    return () => {
      subscription.unsubscribe();
      cancel();
    };
  }, [cancel]);
  if (!visible) return null;
  const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };
  return (
    <InspectorLayout.Provider
      value={{
        open,
        pinned,
        hold,
        hideOrPin: () => {
          if (pinned) {
            setPinned(false);
            setOpen(false);
          } else setPinned(true);
        },
      }}
    >
      <motion.div
        className="inspector-frame"
        initial={false}
        animate={{
          width: open ? 350 : 60,
          paddingLeft: open ? 0 : 40,
          scale: overlay?.state ? 0.97 : 1,
          opacity: overlay?.state ? 0.87 : 1,
        }}
        style={{
          transformOrigin: "right center",
          pointerEvents: "none",
        }}
        transition={spring}
        onMouseEnter={() => {
          inside.current = true;
          cancel();
        }}
        onMouseLeave={() => {
          inside.current = false;
          schedule();
        }}
      >
        <motion.button
          type="button"
          className="inspector-recovery-pill"
          initial={{ opacity: 0 }}
          animate={{ opacity: open ? 0 : 1 }}
          style={{
            backgroundColor: editor ? handleColors(editor).foreground : "#ccc",
            pointerEvents: overlay?.state ? "none" : "auto",
          }}
          aria-label={open ? "Collapse sidebar" : "Show sidebar"}
          onMouseEnter={() => {
            if (!overlay?.state) setOpen(true);
          }}
          onClick={() => setOpen((shown) => !shown)}
        />
        <motion.div
          className="inspector-sliding-panel"
          initial={false}
          animate={{
            x: open ? -16 : 320,
          }}
          transition={spring}
          inert={!open || !!overlay?.state}
          style={{ pointerEvents: overlay?.state ? "none" : "auto" }}
        >
          {children}
        </motion.div>
      </motion.div>
    </InspectorLayout.Provider>
  );
}
