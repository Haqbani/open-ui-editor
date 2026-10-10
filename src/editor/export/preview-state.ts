import type { ExportResult } from "./serialize-email";
export type PreviewState = {
  requestedRevision: number;
  result: ExportResult | null;
};

/** Failures and successes have the same exact-revision acceptance boundary. */
export function acceptPreview(
  current: PreviewState,
  result: ExportResult,
): PreviewState {
  return result.revision === current.requestedRevision
    ? { ...current, result }
    : current;
}
