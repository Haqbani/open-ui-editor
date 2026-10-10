import type { Editor, EditorEvents } from "@tiptap/core";
import { GapCursor } from "@tiptap/pm/gapcursor";
import { Selection } from "@tiptap/pm/state";
import { Mapping } from "@tiptap/pm/transform";
import { getEditorSessionRevision } from "../blocks/commands";
import { normalizeStoredImageHeight } from "../blocks/image";
import { localMediaServices } from "./media";
export const UPLOAD_TIMEOUT_MS = 60000;
const supported = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
]);
function report(editor: Editor, message: string) {
  if (!editor.isDestroyed)
    editor.view.dom.dispatchEvent(
      new CustomEvent("media-error", { detail: message, bubbles: true }),
    );
}
function findUpload(editor: Editor, id: string) {
  let result: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image" && node.attrs.uploadId === id) {
      result = pos;
      return false;
    }
  });
  return result;
}
function removeUpload(editor: Editor, id: string) {
  if (editor.isDestroyed) return;
  const pos = findUpload(editor, id);
  if (pos !== null) {
    const node = editor.state.doc.nodeAt(pos);
    if (node)
      editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
  }
}
function contentWidth(element: HTMLElement) {
  const css = getComputedStyle(element);
  return (
    element.clientWidth -
    parseFloat(css.paddingLeft) -
    parseFloat(css.paddingRight)
  );
}
function ancestorWidth(editor: Editor, pos: number) {
  let width = contentWidth(editor.view.dom);
  const $pos = editor.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const dom = editor.view.nodeDOM($pos.before(depth));
    if (dom instanceof HTMLElement) {
      const measured = contentWidth(dom);
      if (measured > 0 && measured < width) width = measured;
    }
  }
  return width;
}
async function compress(file: File) {
  if (file.type === "image/gif") return file;
  const { default: Compressor } = await import("compressorjs");
  return new Promise<File>(
    (resolve) =>
      new Compressor(file, {
        mimeType: file.type,
        convertSize: Infinity,
        maxWidth: 1500,
        quality: 0.8,
        success: (blob) =>
          resolve(
            blob instanceof File
              ? blob
              : new File([blob], file.name, {
                  type: blob.type,
                  lastModified: file.lastModified,
                }),
          ),
        error: () => resolve(file),
      }),
  );
}
function decodeDurable(url: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const abort = () => {
      image.src = "";
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    image.onload = () => {
      signal.removeEventListener("abort", abort);
      resolve(image);
    };
    image.onerror = () => {
      signal.removeEventListener("abort", abort);
      reject(Error("Couldn't load the uploaded image. Please try again."));
    };
    image.src = url;
  });
}
export function startImageUpload(
  file: File,
  editor: Editor,
  pos: number,
  previous?: Record<string, unknown>,
  id = crypto.randomUUID(),
  replaceSelection = true,
) {
  if (!supported.has(file.type.split(";")[0].trim().toLowerCase())) {
    report(editor, "File type not supported");
    return null;
  }
  if (!replaceSelection) {
    // A GapCursor can map to a nonempty node selection when the first
    // collapse triggers trailing paragraphs. Re-collapse against that state.
    for (let attempt = 0; attempt < 2; attempt++) {
      const boundary = editor.state.doc.resolve(pos);
      // Public GapCursor.map validates the mapped boundary and falls back to
      // a normal selection when a gap cursor is not permitted by the schema.
      const gap = new GapCursor(boundary).map(editor.state.doc, new Mapping());
      const caret =
        Selection.findFrom(boundary, 1, true) ??
        Selection.findFrom(boundary, -1, true) ??
        (gap instanceof GapCursor ? gap : null);
      if (!caret?.empty) return null;
      // Selection-sensitive node filters inspect the prior state, so collapse in
      // a separate selection-only transaction before the boundary insertion.
      const collapse = editor.state.tr.setSelection(caret);
      const mapping = new Mapping();
      let applied = false;
      let mappedDoc = collapse.before;
      const track = ({
        transaction,
        appendedTransactions,
      }: EditorEvents["transaction"]) => {
        if (transaction !== collapse) return;
        applied = true;
        for (const tr of [transaction, ...appendedTransactions])
          mapping.appendMapping(tr.mapping);
        mappedDoc = appendedTransactions.at(-1)?.doc ?? transaction.doc;
      };
      editor.on("transaction", track);
      try {
        editor.view.dispatch(collapse);
      } finally {
        editor.off("transaction", track);
      }
      // Appended normalizers can insert before this boundary, including inside
      // earlier siblings. Stay before content appended at the boundary itself.
      const target = mapping.mapResult(pos, -1);
      if (
        !applied ||
        target.deleted ||
        editor.isDestroyed ||
        editor.state.doc !== mappedDoc
      )
        return null;
      pos = target.pos;
      const current = editor.state.doc.resolve(pos);
      const parent = boundary.depth
        ? editor.state.doc.nodeAt(mapping.map(boundary.before(), 1))
        : editor.state.doc;
      if (
        current.parent !== parent ||
        current.parent.type !== boundary.parent.type ||
        !current.parent.canReplaceWith(
          current.index(),
          current.index(),
          editor.schema.nodes.image,
        )
      )
        return null;
      if (editor.state.selection.empty) break;
    }
    if (!editor.state.selection.empty) return null;
  }
  const blob = URL.createObjectURL(file),
    abort = new AbortController();
  let active = true;
  const timeout = setTimeout(() => {
    if (active) {
      active = false;
      abort.abort();
      removeUpload(editor, id);
      URL.revokeObjectURL(blob);
      report(editor, "Image upload timed out. Please try again.");
    }
  }, UPLOAD_TIMEOUT_MS);
  const attrs = {
    src: blob,
    uploadId: id,
    uploadStartedAt: Date.now(),
    width: previous?.width ?? "100%",
    height: previous?.height ?? null,
    ...(previous?.alignment ? { alignment: previous.alignment } : {}),
    ...(previous?.href ? { href: previous.href } : {}),
    ...(previous?.style ? { style: previous.style } : {}),
  };
  const tr = editor.state.tr;
  if (replaceSelection && !tr.selection.empty) tr.deleteSelection();
  const mapped = tr.mapping.map(pos);
  tr.replaceWith(mapped, mapped, editor.schema.nodes.image.create(attrs));
  editor.view.dispatch(tr);
  if (findUpload(editor, id) === null) {
    active = false;
    clearTimeout(timeout);
    URL.revokeObjectURL(blob);
    return null;
  }
  void (async () => {
    try {
      if (typeof createImageBitmap === "function") {
        try {
          (await createImageBitmap(file)).close();
        } catch {
          throw Error("This image file can't be read. It may be corrupted.");
        }
      }
      let payload = file;
      if (payload.size > 4456448) payload = await compress(file);
      if (!active) return;
      if (payload.size > 4456448) throw Error("File size too big (max 4.5MB)");
      const result = await localMediaServices.upload(
        payload,
        {
          draftId: "foundation",
          revision: getEditorSessionRevision(editor),
          requestId: id,
        },
        abort.signal,
      );
      if (!result.ok) throw Error(result.message);
      const loaded = await decodeDurable(result.value.url, abort.signal);
      if (!active || editor.isDestroyed) return;
      const target = findUpload(editor, id);
      if (target === null) return;
      const node = editor.state.doc.nodeAt(target);
      if (!node) return;
      const fit =
          loaded.naturalWidth > 0 &&
          loaded.naturalWidth <= ancestorWidth(editor, target),
        width = previous?.width ?? (fit ? loaded.naturalWidth : "100%"),
        height = normalizeStoredImageHeight(previous?.height);
      const durable = {
        ...node.attrs,
        src: result.value.url,
        uploadId: null,
        uploadStartedAt: null,
        width,
        height:
          height ??
          (height === undefined && fit && !String(width).includes("%")
            ? loaded.naturalHeight
            : null),
      };
      editor.view.dispatch(
        editor.state.tr.setNodeMarkup(target, null, durable),
      );
    } catch (error) {
      if (active && !editor.isDestroyed) {
        removeUpload(editor, id);
        report(
          editor,
          error instanceof Error
            ? error.message
            : "Error uploading image. Please try again.",
        );
      }
    } finally {
      active = false;
      clearTimeout(timeout);
      URL.revokeObjectURL(blob);
    }
  })();
  return id;
}
export function startImageUploads(
  files: File[],
  editor: Editor,
  pos: number,
  replaceSelection = true,
) {
  let next = pos;
  for (const file of files) {
    const id = startImageUpload(
      file,
      editor,
      Math.min(next, editor.state.doc.content.size),
      undefined,
      undefined,
      replaceSelection,
    );
    if (id) {
      replaceSelection = false;
      const found = findUpload(editor, id);
      if (found !== null)
        next = found + (editor.state.doc.nodeAt(found)?.nodeSize ?? 1);
    }
  }
}
export function chooseImage(
  editor: Editor,
  dropPos?: number,
  replacePos?: number,
) {
  const bookmark = editor.state.selection.getBookmark(),
    revision = getEditorSessionRevision(editor),
    original =
      replacePos === undefined ? null : editor.state.doc.nodeAt(replacePos);
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.multiple = true;
  input.onchange = () => {
    if (editor.isDestroyed) return;
    if (dropPos !== undefined && getEditorSessionRevision(editor) !== revision)
      return;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    if (replacePos !== undefined) {
      if (editor.state.doc.nodeAt(replacePos) !== original) return;
      editor.commands.setNodeSelection(replacePos);
      startImageUpload(files[0], editor, replacePos, original?.attrs);
      return;
    }
    if (dropPos === undefined)
      editor.view.dispatch(
        editor.state.tr.setSelection(bookmark.resolve(editor.state.doc)),
      );
    startImageUploads(
      files,
      editor,
      dropPos ?? editor.state.selection.from,
      dropPos === undefined,
    );
  };
  input.click();
  return true;
}
