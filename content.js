const DEFAULT_VIDEO_LIMIT = 5;
const STORAGE_KEYS = {
    videoLimit: "videoLimit",
    watchedCount: "watchedCount"
};
const SESSION_KEYS = {
    lastCountedVideo: "ytLimitLastCountedVideo"
};
const ELEMENT_IDS = {
    overlay: "yt-limit-block-overlay",
    homeButton: "yt-limit-home-button",
    resetButton: "yt-limit-reset-button",
    summary: "yt-limit-summary",
    watchedValue: "yt-limit-watched-value",
    limitValue: "yt-limit-limit-value",
    remainingValue: "yt-limit-remaining-value",
    progressText: "yt-limit-progress-text",
    progressFill: "yt-limit-progress-fill"
};
const COUNT_DELAY_MS = 1200;

let pendingSyncTimeout = null;
let pendingUrl = null;

const storageGet = (keys) =>
    new Promise((resolve) => {
        chrome.storage.local.get(keys, resolve);
    });

const storageSet = (values) =>
    new Promise((resolve) => {
        chrome.storage.local.set(values, resolve);
    });

const normalizeLimit = (value) => {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_VIDEO_LIMIT;
};

const normalizeCount = (value) => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
};

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

const pauseActiveMedia = () => {
    document.querySelectorAll("video, audio").forEach((mediaElement) => {
        if (typeof mediaElement.pause === "function") {
            mediaElement.pause();
        }
    });
};

const removeBlockScreen = () => {
    document.getElementById(ELEMENT_IDS.overlay)?.remove();
    document.documentElement.classList.remove("yt-limit-locked");
    document.body?.classList.remove("yt-limit-locked");
};

const createBlockScreen = () => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = `
        <div id="${ELEMENT_IDS.overlay}" aria-modal="true" role="dialog">
            <section class="yt-limit-panel">
                <header class="yt-limit-header">
                    <div class="yt-limit-badge">
                        <span class="yt-limit-badge-mark" aria-hidden="true"></span>
                        <span>Cinder</span>
                    </div>

                    <div class="yt-limit-copy">
                        <p class="yt-limit-kicker">Limit aktivny</p>
                        <h1 class="yt-limit-title">Dobra chvila na pauzu.</h1>
                        <p id="${ELEMENT_IDS.summary}" class="yt-limit-summary"></p>
                    </div>
                </header>

                <section class="yt-limit-stats" aria-label="Prehlad limitu">
                    <article class="yt-limit-stat">
                        <span class="yt-limit-stat-label">Pozrete videa</span>
                        <strong id="${ELEMENT_IDS.watchedValue}" class="yt-limit-stat-value">0</strong>
                    </article>

                    <article class="yt-limit-stat">
                        <span class="yt-limit-stat-label">Tvoj limit</span>
                        <strong id="${ELEMENT_IDS.limitValue}" class="yt-limit-stat-value">0</strong>
                    </article>

                    <article class="yt-limit-stat">
                        <span class="yt-limit-stat-label">Nad limitom</span>
                        <strong id="${ELEMENT_IDS.remainingValue}" class="yt-limit-stat-value">0</strong>
                    </article>
                </section>

                <section class="yt-limit-progress" aria-label="Progres limitu">
                    <div class="yt-limit-progress-meta">
                        <span>Stav limitu</span>
                        <span id="${ELEMENT_IDS.progressText}">0 / 0</span>
                    </div>

                    <div class="yt-limit-progress-track" aria-hidden="true">
                        <div id="${ELEMENT_IDS.progressFill}" class="yt-limit-progress-fill"></div>
                    </div>
                </section>

                <p class="yt-limit-note">
                    Feed pocka. Mozes sa vratit na domovsku alebo resetovat pocitadlo, ak chces zacat odznova.
                </p>

                <div class="yt-limit-actions">
                    <button id="${ELEMENT_IDS.homeButton}" class="yt-limit-button yt-limit-button-primary" type="button">
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M3 9.5L10 4L17 9.5V16H12.5V11.5H7.5V16H3V9.5Z" fill="currentColor"></path>
                        </svg>
                        <span>Na domovsku</span>
                    </button>

                    <button id="${ELEMENT_IDS.resetButton}" class="yt-limit-button yt-limit-button-secondary" type="button">
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                            <path d="M4.5 5.5V10H9" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                            <path d="M5.2 10A5.5 5.5 0 1 0 10 4.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
                        </svg>
                        <span>Resetovat pocitadlo</span>
                    </button>
                </div>
            </section>
        </div>
    `;

    const overlayElement = wrapper.firstElementChild;
    document.body.appendChild(overlayElement);

    document.documentElement.classList.add("yt-limit-locked");
    document.body.classList.add("yt-limit-locked");

    document.getElementById(ELEMENT_IDS.homeButton)?.addEventListener("click", () => {
        window.location.href = "https://www.youtube.com/";
    });

    document.getElementById(ELEMENT_IDS.resetButton)?.addEventListener("click", async () => {
        await storageSet({ [STORAGE_KEYS.watchedCount]: 0 });
    });

    return overlayElement;
};

const renderBlockScreen = (watchedCount, videoLimit) => {
    const overlayElement =
        document.getElementById(ELEMENT_IDS.overlay) || createBlockScreen();
    const remainingOverLimit = Math.max(watchedCount - videoLimit, 0);
    const progressRatio = Math.min(watchedCount / videoLimit, 1);

    document.getElementById(ELEMENT_IDS.summary).textContent =
        `Cinder napocital ${watchedCount} videi alebo Shorts. Tvoj limit je ${videoLimit}, preto je dalsie sledovanie zatial pozastavene.`;
    document.getElementById(ELEMENT_IDS.watchedValue).textContent = String(watchedCount);
    document.getElementById(ELEMENT_IDS.limitValue).textContent = String(videoLimit);
    document.getElementById(ELEMENT_IDS.remainingValue).textContent = String(remainingOverLimit);
    document.getElementById(ELEMENT_IDS.progressText).textContent = `${watchedCount} / ${videoLimit}`;
    document.getElementById(ELEMENT_IDS.progressFill).style.width = `${progressRatio * 100}%`;

    pauseActiveMedia();

    return overlayElement;
};

const syncVideoState = async (expectedUrl = window.location.href) => {
    if (expectedUrl !== window.location.href) {
        return;
    }

    const currentUrl = window.location.href;

    if (!isVideoPage(currentUrl)) {
        removeBlockScreen();
        return;
    }

    const currentVideoIdentifier = getVideoIdentifier();

    if (!currentVideoIdentifier) {
        removeBlockScreen();
        return;
    }

    const storedData = await storageGet([
        STORAGE_KEYS.videoLimit,
        STORAGE_KEYS.watchedCount
    ]);

    const videoLimit = normalizeLimit(storedData[STORAGE_KEYS.videoLimit]);
    let watchedCount = normalizeCount(storedData[STORAGE_KEYS.watchedCount]);
    const lastCountedVideo = sessionStorage.getItem(SESSION_KEYS.lastCountedVideo);

    if (lastCountedVideo !== currentVideoIdentifier) {
        watchedCount += 1;
        sessionStorage.setItem(SESSION_KEYS.lastCountedVideo, currentVideoIdentifier);
        await storageSet({ [STORAGE_KEYS.watchedCount]: watchedCount });
    }

    if (watchedCount > videoLimit) {
        renderBlockScreen(watchedCount, videoLimit);
        return;
    }

    removeBlockScreen();
};

const scheduleVideoStateSync = () => {
    const currentUrl = window.location.href;

    pendingUrl = currentUrl;

    if (pendingSyncTimeout) {
        window.clearTimeout(pendingSyncTimeout);
    }

    pendingSyncTimeout = window.setTimeout(() => {
        pendingSyncTimeout = null;

        if (pendingUrl !== window.location.href) {
            return;
        }

        void syncVideoState(currentUrl);
    }, COUNT_DELAY_MS);
};

chrome.storage.local.get(STORAGE_KEYS.videoLimit, (result) => {
    if (!result[STORAGE_KEYS.videoLimit]) {
        chrome.storage.local.set({ [STORAGE_KEYS.videoLimit]: DEFAULT_VIDEO_LIMIT });
    }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
        return;
    }

    if (changes[STORAGE_KEYS.videoLimit] || changes[STORAGE_KEYS.watchedCount]) {
        void syncVideoState();
    }
});

window.addEventListener("yt-navigate-finish", () => {
    scheduleVideoStateSync();
});

scheduleVideoStateSync();
