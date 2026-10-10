import { storeAsset } from "../../../editor/services/asset-storage";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 10 * 1024 * 1024)
      return Response.json({ error: "Image exceeds 10 MB" }, { status: 413 });
    const id = await storeAsset(
      new Uint8Array(await request.arrayBuffer()),
      (request.headers.get("content-type") ?? "").replace(
        /^image\/jpg$/,
        "image/jpeg",
      ),
    );
    return Response.json({
      url: new URL(`/api/assets/${id}`, request.url).href,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
