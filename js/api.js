// ─── api.js ─────────────────────────────────────────────
// Image fetching, URL processing, and download utilities.
// No DOM dependencies — safe to use in any context.
// ────────────────────────────────────────────────────────

// ─── URL / Filename Utilities ───────────────────────────

function extractXUserAndPost(url) {
  const m = String(url).match(
    /^https?:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/(\d+)/
  );
  if (!m) return null;
  return { userId: m[1], postId: m[2] };
}

function generateImageName(userId, postId, index, ext = "png") {
  const suffix = index != null ? `_${index + 1}` : "";
  return `@${userId}_status_${postId}${suffix}.${ext}`;
}

function extractImageId(url) {
  const match = String(url).match(/pbs\.twimg\.com\/media\/([^?/]+)/);
  return match ? match[1] : null;
}

function buildTwimgUrl(imageId, imgtype) {
  if (!imageId) return null;
  if (imgtype === "orig")
    return `https://pbs.twimg.com/media/${imageId}?format=jpg&name=orig`;
  return `https://pbs.twimg.com/media/${imageId}?format=png&name=large`;
}

/**
 * Convert a raw twimg photo URL to the specified format.
 * Input examples:
 *   https://pbs.twimg.com/media/ABC123.jpg
 *   https://pbs.twimg.com/media/ABC123?format=jpg&name=medium
 */
function convertPhotoUrl(rawUrl, imgtype) {
  const id = extractImageId(rawUrl);
  if (id) return buildTwimgUrl(id, imgtype);
  // Fallback: append format params
  if (imgtype === "orig") {
    return rawUrl.replace(/\?.*$/, "") + "?format=jpg&name=orig";
  }
  return rawUrl.replace(/\?.*$/, "") + "?format=png&name=large";
}

function normalizeImageFilename(filename, imgtype, blobType) {
  const desiredExt = imgtype === "orig" ? "jpg" : "png";
  const fromMime =
    blobType === "image/jpeg"
      ? "jpg"
      : blobType === "image/png"
        ? "png"
        : null;
  const ext = fromMime ?? desiredExt;
  const hasExt = /\.[a-z0-9]+$/i.test(filename);
  if (!hasExt) return `${filename}.${ext}`;
  return filename.replace(/\.[a-z0-9]+$/i, `.${ext}`);
}

// ─── CORS Proxy / Blob Fetcher ───────────────────────────

// CORS proxy list — tried in order; first success wins
const CORS_PROXIES = [
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
];

async function urlToBlob(url) {
  // 1) Try direct fetch first (works when same-origin or CORS allowed)
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (res.ok) return await res.blob();
  } catch (_) {}

  // 2) Try CORS proxies
  for (const makeProxy of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxy(url);
      const res = await fetch(proxyUrl, { credentials: "omit" });
      if (res.ok) {
        const blob = await res.blob();
        // Some proxies return text/html on error — verify it's an image
        if (blob.type && blob.type.startsWith("image/")) return blob;
        // If type is empty but size is reasonable, assume image
        if (!blob.type && blob.size > 1024) return blob;
      }
    } catch (_) {}
  }

  throw new Error(
    "CORS error: Could not fetch the image. Try right-click → Save image as."
  );
}

// ─── Download Helper ─────────────────────────────────────

function downloadBlob(blob, filename) {
  const objectURL = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename;
  a.href = objectURL;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(objectURL);
    a.remove();
  }, 100);
}

// ─── VxTwitter API ──────────────────────────────────────

/**
 * @param {string} tweetId
 * @param {string} [userId]  screen_name (improves API routing when available)
 */
async function fetchTweetMedia(tweetId, userId) {
  const path = userId
    ? `${userId}/status/${tweetId}`
    : `status/${tweetId}`;
  const apiUrl = `https://api.fxtwitter.com/${path}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(
      `VxTwitter API error: ${res.status} ${res.statusText}`
    );
  }
  const data = await res.json();
  const tweet = data.tweet;
  if (!tweet) throw new Error("Could not retrieve tweet data");

  const photos = [];
  if (tweet.media?.photos) {
    for (const photo of tweet.media.photos) {
      photos.push(photo.url);
    }
  }
  // mosaic (4-image collage) — individual URLs preferred
  if (photos.length === 0 && tweet.media?.mosaic) {
    throw new Error("No images found in this post (may be video/GIF-only)");
  }
  if (photos.length === 0) {
    throw new Error("No images found in this post (may be video/GIF-only)");
  }
  return {
    userId: tweet.author?.screen_name ?? "unknown",
    photos,
  };
}
