// ─── ui.js ──────────────────────────────────────────────
// UI control: DOM helpers, event handlers, and rendering.
// Depends on api.js and video.js being loaded first.
// ────────────────────────────────────────────────────────

// ─── DOM Shortcuts ───────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const $all = (sel) => document.querySelectorAll(sel);

// ─── Format Helper ───────────────────────────────────────

function getSelectedFormat() {
  const checked = document.querySelector('input[name="format"]:checked');
  return checked ? checked.value : "png";
}

// ─── Status Messages ─────────────────────────────────────

function showStatus(msg, type = "info") {
  const el = $("#statusArea");
  el.className =
    "mb-6 rounded-xl border px-4 py-3 text-sm animate-fade-in";
  if (type === "error") {
    el.classList.add(
      "border-red-300",
      "bg-red-50",
      "text-red-700",
      "dark:border-red-700/50",
      "dark:bg-red-900/20",
      "dark:text-red-400"
    );
  } else if (type === "success") {
    el.classList.add(
      "border-green-300",
      "bg-green-50",
      "text-green-700",
      "dark:border-green-700/50",
      "dark:bg-green-900/20",
      "dark:text-green-400"
    );
  } else {
    el.classList.add(
      "border-blue-300",
      "bg-blue-50",
      "text-blue-700",
      "dark:border-blue-700/50",
      "dark:bg-blue-900/20",
      "dark:text-blue-400"
    );
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideStatus() {
  $("#statusArea").classList.add("hidden");
}

// ─── Button State ────────────────────────────────────────

function setLoading(loading) {
  const btn = $("#extractBtn");
  const icon = $("#extractIcon");
  const spinner = $("#extractSpinner");
  const text = $("#extractBtnText");
  btn.disabled = loading;
  if (loading) {
    icon.classList.add("hidden");
    spinner.classList.remove("hidden");
    text.textContent = "Loading...";
  } else {
    icon.classList.remove("hidden");
    spinner.classList.add("hidden");
    text.textContent = "Extract";
  }
}

// ─── Image Card / Grid Rendering ─────────────────────────

function createImageCard(photoUrl, index, userId, postId) {
  const imgtype = getSelectedFormat();
  const displayUrl = convertPhotoUrl(photoUrl, imgtype);

  const card = document.createElement("div");
  card.className =
    "img-card group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-xdarker animate-slide-up";
  card.style.animationDelay = `${index * 80}ms`;
  card.style.opacity = "0";

  card.innerHTML = `
    <div class="relative aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-gray-800">
      <img
        src="${displayUrl}"
        alt="Image ${index + 1}"
        class="h-full w-full object-contain"
        loading="lazy"
        onerror="this.parentElement.innerHTML='<div class=\'flex h-full items-center justify-center text-gray-400 dark:text-gray-500\'>Failed to load image</div>'"
      />
      <div class="img-overlay absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent p-3">
        <span class="rounded bg-black/50 px-2 py-0.5 text-xs text-white/90">${index + 1} / ${postId ? "@" + userId : "image"}</span>
      </div>
    </div>
    <div class="flex items-center justify-between px-3 py-2.5">
      <span class="truncate text-xs text-gray-500 dark:text-gray-400" title="${displayUrl}">
        ${extractImageId(displayUrl) ?? "image"}_${index + 1}
      </span>
      <button
        class="dl-single-btn inline-flex items-center gap-1 rounded-lg bg-xblue/10 px-2.5 py-1 text-xs font-medium text-xblue hover:bg-xblue/20"
        data-url="${displayUrl}"
        data-index="${index}"
      >
        <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        DL
      </button>
    </div>
  `;
  return card;
}

function renderImages(photos, userId, postId) {
  const grid = $("#imageGrid");
  const section = $("#resultsSection");
  const countEl = $("#imageCount");
  const dlAllBtn = $("#downloadAllBtn");

  grid.innerHTML = "";
  photos.forEach((url, i) => {
    grid.appendChild(createImageCard(url, i, userId, postId));
  });

  countEl.textContent = `${photos.length} image${photos.length !== 1 ? "s" : ""}`;
  section.classList.remove("hidden");
  dlAllBtn.classList.toggle("hidden", photos.length <= 1);

  // Attach single-download handlers
  grid.querySelectorAll(".dl-single-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const imgUrl = btn.dataset.url;
      const idx = parseInt(btn.dataset.index, 10);
      const imgtype = getSelectedFormat();
      btn.disabled = true;
      btn.textContent = "...";
      try {
        const blob = await urlToBlob(imgUrl);
        const filename = normalizeImageFilename(
          generateImageName(userId, postId, idx),
          imgtype,
          blob.type
        );
        downloadBlob(blob, filename);
      } catch (err) {
        console.error(err);
        showStatus(
          `Image ${idx + 1}: CORS error — opened in a new tab. Right-click → Save to download.`,
          "error"
        );
        window.open(imgUrl, "_blank");
      } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> DL`;
      }
    });
  });
}

// ─── Video Status / Loading ─────────────────────────────

function showVideoStatus(msg, type = "info") {
  const el = $("#videoStatusArea");
  el.className = "mb-6 rounded-xl border px-4 py-3 text-sm animate-fade-in";
  if (type === "error") {
    el.classList.add(
      "border-red-300", "bg-red-50", "text-red-700",
      "dark:border-red-700/50", "dark:bg-red-900/20", "dark:text-red-400"
    );
  } else if (type === "success") {
    el.classList.add(
      "border-green-300", "bg-green-50", "text-green-700",
      "dark:border-green-700/50", "dark:bg-green-900/20", "dark:text-green-400"
    );
  } else {
    el.classList.add(
      "border-blue-300", "bg-blue-50", "text-blue-700",
      "dark:border-blue-700/50", "dark:bg-blue-900/20", "dark:text-blue-400"
    );
  }
  el.textContent = msg;
  el.classList.remove("hidden");
}

function hideVideoStatus() {
  $("#videoStatusArea").classList.add("hidden");
}

function setVideoLoading(loading) {
  const btn = $("#videoExtractBtn");
  const icon = $("#videoExtractIcon");
  const spinner = $("#videoExtractSpinner");
  const text = $("#videoExtractBtnText");
  btn.disabled = loading;
  if (loading) {
    icon.classList.add("hidden");
    spinner.classList.remove("hidden");
    text.textContent = "Loading...";
  } else {
    icon.classList.remove("hidden");
    spinner.classList.add("hidden");
    text.textContent = "Extract";
  }
}

function updateVideoUrlDisplay(url) {
  const urlEl = $("#videoUrlDisplay");
  const copyBtn = $("#videoUrlCopyBtn");
  const safeUrl = (url || "").trim();
  urlEl.textContent = safeUrl;
  copyBtn.disabled = !safeUrl;
}

// ─── Video Result Rendering ──────────────────────────────

function renderVideoResult(videos, userId, postId) {
  const grid = $("#videoGrid");
  const section = $("#videoResultSection");
  const countEl = $("#videoCount");

  grid.innerHTML = "";
  updateVideoUrlDisplay(videos[0]?.url || "");
  videos.forEach((video, i) => {
    const card = document.createElement("div");
    card.className =
      "rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm dark:border-gray-700 dark:bg-xdarker animate-slide-up";
    card.style.animationDelay = `${i * 80}ms`;
    card.style.opacity = "0";

    // Build variant options for quality selector
    const isGif = video.type === "gif";
    const variantOptions = video.variants
      .map(
        (vr, vi) =>
          `<option value="${vr.url}" ${vi === 0 ? "selected" : ""}>${formatBitrate(vr.bitrate, video.type)}</option>`
      )
      .join("");

    const meta = [
      video.width && video.height ? `${video.width}×${video.height}` : null,
      formatDuration(video.duration),
      `@${userId}`,
    ]
      .filter(Boolean)
      .join(" · ");

    card.innerHTML = `
      <div class="relative bg-black">
        ${isGif ? `<span class="absolute top-2 left-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">GIF</span>` : ""}
        <video
          controls
          preload="metadata"
          ${isGif ? "loop autoplay muted" : ""}
          poster="${video.thumb}"
          src="${video.url}"
          class="w-full max-h-[480px] object-contain"
        ></video>
      </div>
      <div class="px-4 py-3 space-y-3">
        <div class="flex flex-wrap items-center gap-2">
          ${video.variants.length > 1 ? `
          <select class="video-quality-select flex-1 min-w-0 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs dark:border-gray-600 dark:bg-xdarker" data-index="${i}">
            ${variantOptions}
          </select>` : `<span class="flex-1 text-xs text-gray-500 dark:text-gray-400">${formatBitrate(video.variants[0]?.bitrate, video.type)}</span>`}
          <button
            class="video-dl-btn inline-flex items-center gap-1.5 rounded-lg bg-xblue px-3 py-1.5 text-xs font-semibold text-white hover:bg-xblue/90 disabled:opacity-50"
            data-url="${video.url}"
            data-index="${i}"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Download
          </button>
          <a
            href="${video.url}"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700/50 video-open-link"
          >
            <svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
            </svg>
            Open
          </a>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500">${meta}</p>
      </div>
    `;

    // Quality select → update video src and download button
    const qualitySel = card.querySelector(".video-quality-select");
    if (qualitySel) {
      qualitySel.addEventListener("change", () => {
        const newUrl = qualitySel.value;
        const videoEl = card.querySelector("video");
        const dlBtn = card.querySelector(".video-dl-btn");
        const openLink = card.querySelector(".video-open-link");
        if (videoEl) { videoEl.src = newUrl; videoEl.load(); }
        if (dlBtn) dlBtn.dataset.url = newUrl;
        if (openLink) openLink.href = newUrl;
        updateVideoUrlDisplay(newUrl);
      });
    }

    // Download button handler
    const dlBtn = card.querySelector(".video-dl-btn");
    dlBtn.addEventListener("click", async () => {
      const videoUrl = dlBtn.dataset.url;
      const idx = parseInt(dlBtn.dataset.index, 10);
      updateVideoUrlDisplay(videoUrl);
      dlBtn.disabled = true;
      dlBtn.textContent = "Downloading...";
      try {
        const blob = await urlToBlob(videoUrl);
        downloadBlob(blob, generateVideoName(userId, postId, videos.length > 1 ? idx : null));
        showVideoStatus("Download started", "success");
      } catch (err) {
        console.error(err);
        showVideoStatus(
          "CORS error — opened in a new tab. Right-click the video → Save video as.",
          "error"
        );
        window.open(videoUrl, "_blank");
      } finally {
        dlBtn.disabled = false;
        dlBtn.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download`;
      }
    });

    grid.appendChild(card);
  });

  countEl.textContent = `${videos.length} video${videos.length !== 1 ? "s" : ""}`;
  section.classList.remove("hidden");
}

// ─── Video Extract Handler ───────────────────────────────

let currentVideoResult = null;

async function handleVideoExtract() {
  const input = $("#videoUrlInput").value.trim();
  if (!input) {
    showVideoStatus("Please enter a URL", "error");
    return;
  }

  const parsed = extractXUserAndPost(input);
  if (!parsed) {
    showVideoStatus(
      "Please enter a valid X (Twitter) post URL\ne.g. https://x.com/user/status/123456789",
      "error"
    );
    return;
  }

  hideVideoStatus();
  updateVideoUrlDisplay("");
  setVideoLoading(true);

  try {
    const result = await fetchTweetVideo(parsed.postId, parsed.userId);
    currentVideoResult = { ...result, postId: parsed.postId };
    renderVideoResult(result.videos, result.userId, parsed.postId);
    showVideoStatus(
      `Extracted ${result.videos.length} video${result.videos.length !== 1 ? "s" : ""} (@${result.userId})`,
      "success"
    );
  } catch (err) {
    console.error("Video extract failed:", err);
    updateVideoUrlDisplay("");
    showVideoStatus(`Failed to extract video: ${err.message}`, "error");
  } finally {
    setVideoLoading(false);
  }
}

// ─── Fallback Panel ──────────────────────────────────────

function isFallbackMode() {
  return new URLSearchParams(window.location.search).get("fallback") === "1";
}

function openFallbackPanel() {
  const section = $("#fallbackSection");
  const panel = $("#fallbackPanel");
  const chevron = $("#fallbackChevron");
  section.classList.remove("hidden");
  panel.classList.remove("hidden");
  chevron.style.transform = "rotate(90deg)";
}

// ─── Main Extract Handler ────────────────────────────────

// Store current result for download-all
let currentResult = null;

async function handleExtract() {
  const input = $("#postUrlInput").value.trim();
  if (!input) {
    showStatus("Please enter a URL", "error");
    return;
  }

  const parsed = extractXUserAndPost(input);
  if (!parsed) {
    showStatus(
      "Please enter a valid X (Twitter) post URL\ne.g. https://x.com/user/status/123456789",
      "error"
    );
    return;
  }

  hideStatus();
  setLoading(true);

  try {
    const result = await fetchTweetMedia(parsed.postId, parsed.userId);
    const userId = result.userId;

    currentResult = {
      photos: result.photos,
      userId,
      postId: parsed.postId,
    };

    renderImages(result.photos, userId, parsed.postId);
    showStatus(
      `Extracted ${result.photos.length} image${result.photos.length !== 1 ? "s" : ""} (@${userId})`,
      "success"
    );
  } catch (err) {
    console.error("VxTwitter API failed:", err);
    showStatus(
      `Failed to extract images: ${err.message}\nTry entering the image URL directly below.`,
      "error"
    );
    openFallbackPanel();
  } finally {
    setLoading(false);
  }
}

// ─── Init ────────────────────────────────────────────────

function init() {
  // Extract button
  $("#extractBtn").addEventListener("click", handleExtract);

  // Paste button
  $("#pasteBtn").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        $("#postUrlInput").value = text.trim();
        $("#postUrlInput").focus();
      }
    } catch (err) {
      showStatus("Could not access clipboard. Please paste manually.", "error");
    }
  });

  // Enter key on input
  $("#postUrlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleExtract();
  });

  // Download all
  $("#downloadAllBtn").addEventListener("click", async () => {
    if (!currentResult) return;
    const { photos, userId, postId } = currentResult;
    const imgtype = getSelectedFormat();
    const btn = $("#downloadAllBtn");
    btn.disabled = true;
    btn.textContent = "Downloading...";

    let failCount = 0;
    for (let i = 0; i < photos.length; i++) {
      try {
        const url = convertPhotoUrl(photos[i], imgtype);
        const blob = await urlToBlob(url);
        const filename = normalizeImageFilename(
          generateImageName(userId, postId, i),
          imgtype,
          blob.type
        );
        downloadBlob(blob, filename);
        // Small delay between downloads to avoid browser blocking
        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`Image ${i + 1} failed:`, err);
        failCount++;
        const url = convertPhotoUrl(photos[i], imgtype);
        window.open(url, "_blank");
      }
    }
    if (failCount > 0) {
      showStatus(
        `${failCount} image${failCount !== 1 ? "s" : ""} opened in new tab${failCount !== 1 ? "s" : ""} due to CORS error. Right-click → Save to download.`,
        "error"
      );
    }

    btn.disabled = false;
    btn.innerHTML = `<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg> Download All`;
  });

  // Fallback toggle
  $("#fallbackToggle").addEventListener("click", () => {
    const panel = $("#fallbackPanel");
    const chevron = $("#fallbackChevron");
    const isHidden = panel.classList.contains("hidden");
    panel.classList.toggle("hidden");
    chevron.style.transform = isHidden ? "rotate(90deg)" : "";
  });

  // Manual preview
  $("#manualPreviewBtn").addEventListener("click", () => {
    const imgUrl = $("#manualImgUrl").value.trim();
    if (!imgUrl) {
      showStatus("Please enter an image URL", "error");
      return;
    }
    const imgtype = getSelectedFormat();
    const id = extractImageId(imgUrl);
    const displayUrl = id ? buildTwimgUrl(id, imgtype) : imgUrl;
    const area = $("#manualPreviewArea");
    area.innerHTML = `
      <div class="mt-3 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <img src="${displayUrl}" alt="Preview" class="w-full" onerror="this.alt='Failed to load image'" />
      </div>
      <p class="mt-1 break-all text-xs text-gray-400">${displayUrl}</p>
    `;
  });

  // Manual download
  $("#manualDownloadBtn").addEventListener("click", async () => {
    const imgUrl = $("#manualImgUrl").value.trim();
    if (!imgUrl) {
      showStatus("Please enter an image URL", "error");
      return;
    }

    const imgtype = getSelectedFormat();
    const id = extractImageId(imgUrl);
    const url = id ? buildTwimgUrl(id, imgtype) : imgUrl;

    const postUrl = $("#manualPostUrl").value.trim();
    const parsed = extractXUserAndPost(postUrl);

    try {
      const blob = await urlToBlob(url);
      let filename;
      if (parsed) {
        filename = normalizeImageFilename(
          generateImageName(parsed.userId, parsed.postId, null),
          imgtype,
          blob.type
        );
      } else {
        const ext = imgtype === "orig" ? "jpg" : "png";
        filename = `x_image_${Date.now()}.${ext}`;
      }
      downloadBlob(blob, filename);
      showStatus("Download started", "success");
    } catch (err) {
      console.error(err);
      showStatus(
        "CORS error — opened in a new tab. Right-click → Save to download.",
        "error"
      );
      window.open(url, "_blank");
      showStatus(`Download failed: ${err.message}`, "error");
    }
  });

  // Re-render results when format changes
  $all('input[name="format"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      if (currentResult) {
        renderImages(
          currentResult.photos,
          currentResult.userId,
          currentResult.postId
        );
      }
    });
  });

  // Show fallback section if ?fallback=1
  if (isFallbackMode()) {
    $("#fallbackSection").classList.remove("hidden");
  }

  // ─── Tab switching ───────────────────────────────────
  const imagesTab = $("#imagesTab");
  const videosTab = $("#videosTab");
  const imagesSection = $("#imagesSection");
  const videosSection = $("#videosSection");

  function activateTab(tab) {
    const isImages = tab === "images";
    imagesTab.classList.toggle("border-xblue", isImages);
    imagesTab.classList.toggle("text-xblue", isImages);
    imagesTab.classList.toggle("border-transparent", !isImages);
    imagesTab.classList.toggle("text-gray-500", !isImages);
    videosTab.classList.toggle("border-xblue", !isImages);
    videosTab.classList.toggle("text-xblue", !isImages);
    videosTab.classList.toggle("border-transparent", isImages);
    videosTab.classList.toggle("text-gray-500", isImages);
    imagesSection.classList.toggle("hidden", !isImages);
    videosSection.classList.toggle("hidden", isImages);
  }

  imagesTab.addEventListener("click", () => activateTab("images"));
  videosTab.addEventListener("click", () => activateTab("videos"));

  // ─── Video event handlers ────────────────────────────
  $("#videoExtractBtn").addEventListener("click", handleVideoExtract);

  $("#videoPasteBtn").addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        $("#videoUrlInput").value = text.trim();
        $("#videoUrlInput").focus();
      }
    } catch (err) {
      showVideoStatus("Could not access clipboard. Please paste manually.", "error");
    }
  });

  $("#videoUrlInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleVideoExtract();
  });

  $("#videoUrlCopyBtn").addEventListener("click", async () => {
    const videoUrl = $("#videoUrlDisplay").textContent.trim();
    if (!videoUrl) {
      showVideoStatus("No video URL to copy", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(videoUrl);
      showVideoStatus("Video URL copied to clipboard", "success");
    } catch (_) {
      showVideoStatus("Could not copy URL. Please copy manually.", "error");
    }
  });

  // Theme toggle
  const themeToggle = $("#themeToggle");
  const html = document.documentElement;

  // Detect saved preference or system preference
  const saved = localStorage.getItem("theme");
  if (saved === "light") {
    html.classList.remove("dark");
  } else if (saved === "dark") {
    html.classList.add("dark");
  } else {
    if (!window.matchMedia("(prefers-color-scheme: dark)").matches) {
      html.classList.remove("dark");
    }
  }

  themeToggle.addEventListener("click", () => {
    const isDark = html.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  });
}

window.addEventListener("DOMContentLoaded", init);
