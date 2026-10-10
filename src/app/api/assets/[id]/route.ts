import { readAsset } from "../../../../editor/services/asset-storage";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const asset = await readAsset((await params).id);
  return asset
    ? new Response(new Uint8Array(asset.bytes), {
        headers: {
          "Content-Type": asset.type,
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Content-Type-Options": "nosniff",
        },
      })
    : new Response("Not found", { status: 404 });
}
