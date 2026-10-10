export const runtime = "nodejs";
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  let url: URL;
  try {
    url = new URL(raw ?? "");
  } catch {
    return new Response("Invalid image URL", { status: 400 });
  }
  if (
    url.origin !== "https://img.youtube.com" ||
    !/^\/vi\/[a-zA-Z0-9_-]+\/(maxresdefault|hqdefault)\.jpg$/.test(
      url.pathname,
    ) ||
    url.search ||
    url.hash
  )
    return new Response("Unsupported thumbnail URL", { status: 400 });
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return new Response("Thumbnail unavailable", { status: 502 });
    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public,max-age=3600",
      },
    });
  } catch {
    return new Response("Thumbnail unavailable", { status: 502 });
  }
}
