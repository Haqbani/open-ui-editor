import { validateDocument } from "../document-contract";
import type {
  DocumentContract,
  DraftStorage,
  SaveResult,
  TemplateDraft,
} from "../types";

const STORAGE_PREFIX = "open-ui-editor:local-draft:";
type StoredDraft = Omit<TemplateDraft, "document"> & { document: unknown };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function storedDraft(value: unknown, id: string): value is StoredDraft {
  if (!record(value) || !record(value.metadata)) return false;
  const metadata = value.metadata;
  return (
    value.id === id &&
    typeof value.title === "string" &&
    typeof value.revision === "number" &&
    Number.isSafeInteger(value.revision) &&
    value.revision >= 0 &&
    ["from", "replyTo", "subject", "previewText"].every(
      (field) => typeof metadata[field] === "string",
    ) &&
    record(value.document)
  );
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Local draft storage is unavailable.";
}

/** Local development persistence, independent of remote services. */
export function readDraft(
  storage: DraftStorage,
  id: string,
  contract: DocumentContract,
):
  | { kind: "loaded"; draft: TemplateDraft }
  | { kind: "missing" }
  | { kind: "invalid"; message: string; raw: string }
  | { kind: "unavailable"; message: string } {
  let raw: string | null;
  try {
    raw = storage.getItem(`${STORAGE_PREFIX}${id}`);
  } catch (error) {
    return { kind: "unavailable", message: message(error) };
  }
  if (raw === null) return { kind: "missing" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: "invalid", message: "Local draft is not valid JSON.", raw };
  }
  if (!storedDraft(parsed, id))
    return {
      kind: "invalid",
      raw,
      message: "Local draft fields or revision are invalid.",
    };
  const validation = validateDocument(parsed.document, contract);
  if (!validation.ok)
    return {
      kind: "invalid",
      raw,
      message: validation.issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join(" "),
    };
  return {
    kind: "loaded",
    draft: { ...parsed, document: validation.document },
  };
}

/** Synchronous local writes reject older revisions; this is not cross-tab coordination. */
export function writeDraft(
  storage: DraftStorage,
  draft: TemplateDraft,
  contract: DocumentContract,
): SaveResult {
  const unavailable: SaveResult = {
    ok: false,
    revision: draft.revision,
    reason: "unavailable",
  };
  try {
    if (
      !storedDraft(draft, draft.id) ||
      !validateDocument(draft.document, contract).ok
    )
      return unavailable;
    const key = `${STORAGE_PREFIX}${draft.id}`;
    const raw = storage.getItem(key);
    if (raw !== null) {
      const existing: unknown = JSON.parse(raw);
      // Refuse to replace unreadable data: the caller retains the unsaved in-memory draft.
      if (
        !storedDraft(existing, draft.id) ||
        !validateDocument(existing.document, contract).ok
      )
        return unavailable;
      if (existing.revision > draft.revision)
        return { ok: false, revision: draft.revision, reason: "stale" };
    }
    storage.setItem(key, JSON.stringify(draft));
    return { ok: true, revision: draft.revision };
  } catch {
    return unavailable;
  }
}
