import type { SaveResult, SaveState } from "../types";

export function applySaveResult(
  current: SaveState,
  result: SaveResult,
): SaveState {
  if (result.revision > current.revision) return current;
  if (!result.ok) {
    if (
      result.revision !== current.revision ||
      current.savedRevision >= current.revision
    )
      return current;
    return { ...current, status: "failed" };
  }
  return {
    ...current,
    savedRevision: Math.max(current.savedRevision, result.revision),
    status: result.revision === current.revision ? "saved" : current.status,
  };
}
