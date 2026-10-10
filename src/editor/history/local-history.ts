import { getExtensionField, type JSONContent } from "@tiptap/core";
import {
  Collaboration,
  type CollaborationOptions,
  type CollaborationStorage,
} from "@tiptap/extension-collaboration";
import { prosemirrorJSONToYDoc } from "@tiptap/y-tiptap";
import type { Doc } from "yjs";
import { validateDocument } from "../document-contract";
import type { DocumentContract } from "../types";
import { installHistoryBoundaries } from "./history-boundary";

const field = "local-email-body";
type LocalHistoryStorage = CollaborationStorage & {
  localDocument: Doc | null;
  disposeBoundaries: (() => void) | null;
};

/** One memory-only history session, allocated by actual editor creation. */
export function createLocalHistory(
  document: JSONContent,
  contract: DocumentContract,
) {
  return Collaboration.extend<CollaborationOptions, LocalHistoryStorage>({
    addStorage() {
      return {
        isDisabled: false,
        localDocument: null,
        disposeBoundaries: null,
      };
    },
    onBeforeCreate(event) {
      const validated = validateDocument(document, contract);
      if (!validated.ok)
        throw new Error("Local history requires a validated email document.");
      this.storage.localDocument = prosemirrorJSONToYDoc(
        this.editor.schema,
        validated.document,
        field,
      );
      this.storage.disposeBoundaries = installHistoryBoundaries(this.editor);
      this.parent?.(event);
    },
    addProseMirrorPlugins() {
      // Bind the unchanged public Collaboration plugin owner to this editor's
      // session, rather than mutating extension options shared across editors.
      return getExtensionField(Collaboration, "addProseMirrorPlugins", {
        name: this.name,
        editor: this.editor,
        storage: this.storage,
        options: {
          ...this.options,
          document: this.storage.localDocument,
          field,
        },
      })();
    },
    onDestroy() {
      this.storage.disposeBoundaries?.();
      this.storage.disposeBoundaries = null;
      this.storage.localDocument?.destroy();
      this.storage.localDocument = null;
    },
  });
}
