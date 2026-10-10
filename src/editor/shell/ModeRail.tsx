import type { EditorController } from "../use-editor-controller";
import { Icon } from "./icons";
export function ModeRail({ controller }: { controller: EditorController }) {
  return (
    <nav aria-label="Editor mode" className="mode-rail">
      {(["editor", "code"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          className="icon-button"
          aria-label={mode === "editor" ? "Editor" : "Code"}
          aria-pressed={controller.mode === mode}
          onClick={() => controller.setMode(mode)}
        >
          <Icon name={mode === "editor" ? "Editor" : "Code"} size={18} />
        </button>
      ))}
    </nav>
  );
}
