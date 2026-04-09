const DEFAULT_VIDEO_LIMIT = 5;
const STORAGE_KEYS = {
    videoLimit: "videoLimit",
    watchedCount: "watchedCount"
};

const form = document.getElementById("settings-form");
const limitInput = document.getElementById("video-limit");
const watchedCountElement = document.getElementById("watched-count");
const statusElement = document.getElementById("status");
const resetButton = document.getElementById("reset-count");

const setStatus = (message) => {
    statusElement.textContent = message;
};

const loadSettings = () => {
    chrome.storage.local.get(
        [STORAGE_KEYS.videoLimit, STORAGE_KEYS.watchedCount],
        (result) => {
            limitInput.value = result[STORAGE_KEYS.videoLimit] || DEFAULT_VIDEO_LIMIT;
            watchedCountElement.textContent = result[STORAGE_KEYS.watchedCount] || 0;
        }
    );
};

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const limitValue = Number(limitInput.value);

    if (!Number.isInteger(limitValue) || limitValue < 1) {
        setStatus("Zadaj cele cislo vacsie ako 0.");
        return;
    }

    chrome.storage.local.set({ [STORAGE_KEYS.videoLimit]: limitValue }, () => {
        setStatus("Limit bol ulozeny.");
    });
});

resetButton.addEventListener("click", () => {
    chrome.storage.local.set({ [STORAGE_KEYS.watchedCount]: 0 }, () => {
        watchedCountElement.textContent = 0;
        setStatus("Pocitadlo bolo vynulovane.");
    });
});

loadSettings();
