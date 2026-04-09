const DEFAULT_VIDEO_LIMIT = 5;
const STORAGE_KEYS = {
    videoLimit: "videoLimit",
    watchedCount: "watchedCount"
};
const SESSION_KEYS = {
    lastCountedVideo: "ytLimitLastCountedVideo"
};

const storageGet = (keys) =>
    new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });

const storageSet = (values) =>
    new Promise((resolve) => {
        chrome.storage.local.set(values, resolve);
    });

const isVideoPage = (url) => {
    return url.includes("youtube.com/watch") || url.includes("youtube.com/shorts/");
};

const getVideoIdentifier = () => {
    const url = new URL(window.location.href);

    if (url.pathname.startsWith("/shorts/")) {
        const shortsId = url.pathname.split("/")[2];
        return shortsId ? `shorts:${shortsId}` : null;
    }

    if (url.pathname === "/watch") {
        const videoId = url.searchParams.get("v");
        return videoId ? `watch:${videoId}` : null;
    }

    return null;
};

const renderBlockScreen = async (watchedCount, videoLimit) => {
    if (document.getElementById("yt-limit-block-overlay")) {
        return;
    }

    document.body.innerHTML = `
        <div id="yt-limit-block-overlay" style="display:flex; flex-direction:column; gap:16px; min-height:100vh; align-items:center; justify-content:center; background:#0f0f0f; color:white; font-family:Arial, sans-serif; text-align:center; padding:24px; box-sizing:border-box;">
            <h1 style="font-size:3rem; margin:0;">STOP!</h1>
            <p style="font-size:1.4rem; margin:0;">Dosiahol si limit ${videoLimit} videi.</p>
            <p style="font-size:1rem; margin:0; color:#cfcfcf;">Aktualne mas zapocitanych ${watchedCount} otvorenych videi alebo Shorts.</p>
            <div style="display:flex; gap:12px; flex-wrap:wrap; justify-content:center; margin-top:8px;">
                <button id="yt-limit-home-button" style="padding:14px 24px; border:none; border-radius:999px; cursor:pointer; font-weight:700;">
                    Spat na YouTube domov
                </button>
                <button id="yt-limit-reset-button" style="padding:14px 24px; border:1px solid #666; border-radius:999px; background:transparent; color:white; cursor:pointer; font-weight:700;">
                    Vynulovat pocitadlo
                </button>
            </div>
        </div>
    `;

    document.getElementById("yt-limit-home-button")?.addEventListener("click", () => {
        window.location.href = "https://www.youtube.com/";
    });

    document.getElementById("yt-limit-reset-button")?.addEventListener("click", async () => {
        sessionStorage.removeItem(SESSION_KEYS.lastCountedVideo);
        await storageSet({ [STORAGE_KEYS.watchedCount]: 0 });
        window.location.href = "https://www.youtube.com/";
    });
};

const syncVideoState = async () => {
    const currentUrl = window.location.href;

    if (!isVideoPage(currentUrl)) {
        return;
    }

    const currentVideoIdentifier = getVideoIdentifier();

    if (!currentVideoIdentifier) {
        return;
    }

    const storedData = await storageGet([
        STORAGE_KEYS.videoLimit,
        STORAGE_KEYS.watchedCount
    ]);

    const videoLimit = Number(storedData[STORAGE_KEYS.videoLimit]) || DEFAULT_VIDEO_LIMIT;
    let watchedCount = Number(storedData[STORAGE_KEYS.watchedCount]) || 0;
    const lastCountedVideo = sessionStorage.getItem(SESSION_KEYS.lastCountedVideo);

    if (lastCountedVideo !== currentVideoIdentifier) {
        watchedCount += 1;
        sessionStorage.setItem(SESSION_KEYS.lastCountedVideo, currentVideoIdentifier);
        await storageSet({ [STORAGE_KEYS.watchedCount]: watchedCount });
    }

    if (watchedCount >= videoLimit) {
        await renderBlockScreen(watchedCount, videoLimit);
    }
};

chrome.storage.local.get(STORAGE_KEYS.videoLimit, (result) => {
    if (!result[STORAGE_KEYS.videoLimit]) {
        chrome.storage.local.set({ [STORAGE_KEYS.videoLimit]: DEFAULT_VIDEO_LIMIT });
    }
});

window.addEventListener("yt-navigate-finish", () => {
    void syncVideoState();
});

void syncVideoState();
