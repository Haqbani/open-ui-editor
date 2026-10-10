import type { MediaServices, RequestContext, ServiceResult } from "./types";

function youtubeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  try {
    const url = new URL(
      /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    return ["http:", "https:"].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}
const host = (url: URL) =>
  url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
export function extractYouTubeId(value: string): string | null {
  const url = youtubeUrl(value);
  if (!url) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (host(url) === "youtu.be") return parts[0] ?? null;
  if (host(url) !== "youtube.com") return null;
  return url.pathname === "/watch"
    ? url.searchParams.get("v") || null
    : ["embed", "v"].includes(parts[0])
      ? (parts[1] ?? null)
      : null;
}
export function normalizeYouTubeUrl(value: string): string | null {
  const url = youtubeUrl(value),
    id = extractYouTubeId(value);
  if (!url || !id) return null;
  if (host(url) === "youtu.be") {
    const normalized = new URL("https://www.youtube.com/watch");
    normalized.searchParams.set("v", id);
    for (const [key, val] of url.searchParams)
      if (!["si", "feature", "v"].includes(key))
        normalized.searchParams.append(key, val);
    normalized.hash = url.hash;
    return normalized.toString();
  }
  const trimmed = value.trim();
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
}
export function isTwitterUrl(value: string) {
  try {
    return /^(?:.*\.)?(?:twitter\.com|x\.com)$/.test(
      new URL(value.trim()).hostname,
    );
  } catch {
    return false;
  }
}
export function extractTweetId(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!isTwitterUrl(value)) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    for (let i = 0; i < parts.length - 1; i++)
      if (
        ["status", "statuses"].includes(parts[i]) &&
        /^\d+$/.test(parts[i + 1])
      )
        return parts[i + 1];
    return null;
  } catch {
    return null;
  }
}
function failure(
  context: RequestContext,
  error: unknown,
): ServiceResult<{ url: string }> {
  return {
    ok: false,
    context,
    reason:
      error instanceof DOMException && error.name === "AbortError"
        ? "cancelled"
        : "failed",
    message: error instanceof Error ? error.message : "Media request failed",
  };
}
async function upload(
  file: Blob,
  context: RequestContext,
  signal: AbortSignal,
): Promise<ServiceResult<{ url: string }>> {
  try {
    const response = await fetch("/api/upload-image", {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
      signal,
    });
    if (!response.ok)
      throw Error(`Image upload failed with status ${response.status}`);
    const result = await response.json();
    if (typeof result.url !== "string" || !/^https?:\/\//.test(result.url))
      throw Error("Image upload returned an invalid URL");
    return { ok: true, context, value: { url: result.url } };
  } catch (error) {
    return failure(context, error);
  }
}
async function loadImage(
  url: string,
  signal: AbortSignal,
): Promise<HTMLImageElement> {
  const response = await fetch(url, { signal, cache: "no-store" });
  if (!response.ok)
    throw Error(`Thumbnail fetch failed with status ${response.status}`);
  const source = URL.createObjectURL(await response.blob());
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const abort = () => {
        img.src = "";
        reject(new DOMException("Cancelled", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      img.onload = () => {
        signal.removeEventListener("abort", abort);
        resolve(img);
      };
      img.onerror = () => {
        signal.removeEventListener("abort", abort);
        reject(Error("Thumbnail could not be loaded"));
      };
      img.src = source;
    });
  } finally {
    URL.revokeObjectURL(source);
  }
}
function drawPlay(ctx: CanvasRenderingContext2D) {
  ctx.save();
  const scale = 0.2 * Math.min(ctx.canvas.width / 68, ctx.canvas.height / 48);
  ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-34, -24);
  ctx.beginPath();
  ctx.moveTo(66.52, 7.74);
  ctx.bezierCurveTo(65.74, 4.81, 64.03, 2.33, 61.1, 1.55);
  ctx.bezierCurveTo(55.79, 0.13, 34, 0, 34, 0);
  ctx.bezierCurveTo(34, 0, 12.21, 0.13, 6.9, 1.55);
  ctx.bezierCurveTo(3.97, 2.33, 2.27, 4.81, 1.48, 7.74);
  ctx.bezierCurveTo(0.06, 13.05, 0, 24, 0, 24);
  ctx.bezierCurveTo(0, 24, 0.06, 34.95, 1.48, 40.26);
  ctx.bezierCurveTo(2.26, 43.19, 3.97, 45.67, 6.9, 46.45);
  ctx.bezierCurveTo(12.21, 47.87, 34, 48, 34, 48);
  ctx.bezierCurveTo(34, 48, 55.79, 47.87, 61.1, 46.45);
  ctx.bezierCurveTo(64.03, 45.67, 65.74, 43.19, 66.52, 40.26);
  ctx.bezierCurveTo(67.94, 34.95, 68, 24, 68, 24);
  ctx.bezierCurveTo(68, 24, 67.94, 13.05, 66.52, 7.74);
  ctx.closePath();
  ctx.fillStyle = "#f00";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(45, 24);
  ctx.lineTo(27, 14);
  ctx.lineTo(27, 34);
  ctx.closePath();
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.restore();
}
export const localMediaServices: MediaServices = {
  upload,
  async preview(kind, url, options, context, signal) {
    if (kind === "twitter")
      return {
        ok: false,
        context,
        reason: "unavailable",
        message: "X preview provider is not configured.",
      };
    try {
      const id = extractYouTubeId(url);
      if (!id) throw Error("Invalid YouTube URL");
      let image: HTMLImageElement | null = null;
      for (const quality of ["maxresdefault", "hqdefault"]) {
        try {
          image = await loadImage(
            `/api/proxy-image?url=${encodeURIComponent(`https://img.youtube.com/vi/${id}/${quality}.jpg`)}`,
            signal,
          );
          break;
        } catch (error) {
          if (signal.aborted) throw error;
        }
      }
      if (!image)
        throw Error(`Failed to load YouTube thumbnail for video "${id}"`);
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw Error("Could not get canvas 2d context");
      ctx.drawImage(image, 0, 0);
      if (options.includePlayButton ?? true) drawPlay(ctx);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(Error("toBlob returned null")),
          "image/jpeg",
        ),
      );
      return upload(blob, context, signal);
    } catch (error) {
      return failure(context, error);
    }
  },
};
