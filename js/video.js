// ─── video.js ────────────────────────────────────────────
// Video fetching utilities (no DOM dependencies).
// Depends on api.js (uses extractXUserAndPost, downloadBlob).
// ─────────────────────────────────────────────────────────

function normalizeMediaUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("tag");
    return parsed.toString();
  } catch (_) {
    return url;
  }
}

function isMp4Url(url) {
  return typeof url === "string" && /\.mp4(\?|$)/i.test(url);
}

/**
 * Fetch video info for a tweet via FxTwitter API.
 * Returns { userId, videos: [{ url, variants, thumb, duration, width, height }] }
 */
async function fetchTweetVideo(tweetId, userId) {
  const path = userId ? `${userId}/status/${tweetId}` : `status/${tweetId}`;
  const apiUrl = `https://api.vxtwitter.com/${path}`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    throw new Error(`VxTwitter API error: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  const tweet = data?.tweet ?? data;
  if (!tweet) throw new Error("Could not retrieve tweet data");

  const mediaVideos = Array.isArray(tweet.media?.videos) ? tweet.media.videos : [];
  const extendedVideos = Array.isArray(tweet.media_extended)
    ? tweet.media_extended.filter((m) => m?.type === "video" || m?.type === "gif")
    : [];

  const sourceVideos = mediaVideos.length ? mediaVideos : extendedVideos;

  if (!sourceVideos.length) {
    throw new Error("No videos or GIFs found in this post");
  }

  const videos = sourceVideos.map((v) => {
    // Prefer explicit variants list; fall back to formats
    const rawVariants = v.variants?.length
      ? v.variants
      : v.formats?.length
        ? v.formats
        : v.url
          ? [{ url: v.url, bitrate: v.bitrate ?? 0, content_type: "video/mp4" }]
          : [];
    // Normalize variant URLs (strip problematic params like `tag`)
    const normalizedRaw = rawVariants.map((vr) => ({ ...(vr || {}), url: normalizeMediaUrl(vr.url) }));
    // Filter to MP4-like variants and sort by bitrate descending
    const variants = normalizedRaw
      .filter(
        (vr) =>
          (vr.content_type ?? vr.container) === "video/mp4" ||
          vr.container === "mp4" ||
          isMp4Url(vr.url)
      )
      .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0));

    const finalVariants = variants.length
      ? variants
      : [{ url: normalizeMediaUrl(v.url), bitrate: v.bitrate ?? 0, content_type: "video/mp4" }];

    return {
      url: finalVariants[0]?.url ?? normalizeMediaUrl(v.url),
      variants: finalVariants,
      thumb: v.thumbnail_url ?? "",
      duration: v.duration ?? (typeof v.duration_millis === "number" ? v.duration_millis / 1000 : null),
      width: v.width ?? null,
      height: v.height ?? null,
      type: v.type ?? "video",
    };
  });

  return {
    userId: tweet.author?.screen_name ?? tweet.user_screen_name ?? userId ?? "unknown",
    videos,
  };
}

/**
 * Build a filename for a video download.
 * @param {string} userId
 * @param {string} postId
 * @param {number|null} index  null → single video (no suffix)
 */
function generateVideoName(userId, postId, index = null) {
  const suffix = index != null ? `_${index + 1}` : "";
  return `@${userId}_status_${postId}${suffix}.mp4`;
}

/**
 * Format seconds into mm:ss or hh:mm:ss string.
 */
function formatDuration(seconds) {
  if (!seconds) return null;
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Format bitrate (bps) to human-readable string.
 * Pass type="gif" to get a "GIF" label regardless of bitrate.
 */
function formatBitrate(bps, type) {
  if (type === "gif") return "GIF";
  if (!bps) return "unknown quality";
  const kbps = Math.round(bps / 1000);
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`;
}
