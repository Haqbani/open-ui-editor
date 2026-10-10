import type { BlockTarget } from "../blocks/commands";
export type RequestContext = {
  draftId: string;
  revision: number;
  requestId: string;
  target?: BlockTarget;
};
export type ServiceResult<T> =
  | { ok: true; context: RequestContext; value: T }
  | {
      ok: false;
      context: RequestContext;
      reason: "unavailable" | "failed" | "cancelled" | "stale";
      message: string;
    };
export interface MediaServices {
  upload(
    file: Blob,
    context: RequestContext,
    signal: AbortSignal,
  ): Promise<ServiceResult<{ url: string }>>;
  preview(
    kind: "youtube" | "twitter",
    url: string,
    options: { darkMode?: boolean; includePlayButton?: boolean },
    context: RequestContext,
    signal: AbortSignal,
  ): Promise<ServiceResult<{ url: string }>>;
}
