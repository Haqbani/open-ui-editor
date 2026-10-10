import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const assetDirectory = join(process.cwd(), ".local-assets");
const types: Record<string, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};
export async function storeAsset(bytes: Uint8Array, type: string) {
  const signature =
    type === "image/png" &&
    Buffer.from(bytes.slice(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
      ? "png"
      : type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216
        ? "jpeg"
        : type === "image/gif" &&
            Buffer.from(bytes.slice(0, 6)).toString().startsWith("GIF8")
          ? "gif"
          : type === "image/webp" &&
              Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" &&
              Buffer.from(bytes.slice(8, 12)).toString() === "WEBP"
            ? "webp"
            : null;
  if (!signature || bytes.length === 0 || bytes.length > 10 * 1024 * 1024)
    throw Error("Upload must be a supported raster image under 10 MB.");
  await mkdir(assetDirectory, { recursive: true });
  const id = `${crypto.randomUUID()}.${signature}`;
  await writeFile(join(assetDirectory, id), bytes, { flag: "wx" });
  return id;
}
export async function readAsset(id: string) {
  if (!/^[0-9a-f-]{36}\.(png|jpeg|gif|webp)$/.test(id)) return null;
  try {
    return {
      bytes: await readFile(join(assetDirectory, id)),
      type: types[id.split(".")[1]],
    };
  } catch {
    return null;
  }
}
