import { expect, test } from "vitest";
import {
  extractTweetId,
  extractYouTubeId,
  normalizeYouTubeUrl,
} from "../../src/editor/services/media";

test("source short YouTube normalization removes sharing params preserving time", () => {
  expect(
    normalizeYouTubeUrl(
      "https://youtu.be/aqz-KE-bpKQ?si=neutral&feature=share&t=15",
    ),
  ).toBe("https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=15");
  expect(extractYouTubeId("https://example.com/watch?v=anything")).toBe(null);
  expect(extractTweetId("https://x.com/example/status/20")).toBe("20");
  expect(extractTweetId("https://x.com/example")).toBe(null);
});
