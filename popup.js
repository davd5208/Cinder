const DEFAULT_VIDEO_LIMIT = 5;
const STORAGE_KEYS = {
    videoLimit: "videoLimit",
    watchedCount: "watchedCount"
};

const form = document.getElementById("settings-form");
const limitInput = document.getElementById("video-limit");
const watchedCountElement = document.getElementById("watched-count");
const remainingCountElement = document.getElementById("remaining-count");
const progressTextElement = document.getElementById("progress-text");
const progressFillElement = document.getElementById("progress-fill");
const statePillElement = document.getElementById("state-pill");
const sessionCaptionElement = document.getElementById("session-caption");
const statusElement = document.getElementById("status");
const resetButton = document.getElementById("reset-count");
const presetButtons = Array.from(document.querySelectorAll(".preset-button"));

let currentState = {
    videoLimit: DEFAULT_VIDEO_LIMIT,
    watchedCount: 0
};

const normalizeLimit = (value) => {
    const parsedValue = Number(value);
    return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : DEFAULT_VIDEO_LIMIT;
};

const normalizeCount = (value) => {
    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 0;
};

const setStatus = (message = "", tone = "neutral") => {
    statusElement.textContent = message;

    if (tone === "neutral") {
        statusElement.removeAttribute("data-tone");
        return;
    }

    statusElement.dataset.tone = tone;
};

const updatePresetButtons = (activeLimit) => {
    presetButtons.forEach((button) => {
        button.classList.toggle("is-active", Number(button.dataset.limit) === activeLimit);
    });
};

const renderState = () => {
    const videoLimit = normalizeLimit(currentState.videoLimit);
    const watchedCount = normalizeCount(currentState.watchedCount);
    const remainingCount = Math.max(videoLimit - watchedCount, 0);
    const progressRatio = Math.min(watchedCount / videoLimit, 1);

    watchedCountElement.textContent = String(watchedCount);
    remainingCountElement.textContent = String(remainingCount);
    progressTextElement.textContent = `${watchedCount} / ${videoLimit}`;
    progressFillElement.style.width = `${progressRatio * 100}%`;
    limitInput.value = String(videoLimit);
    updatePresetButtons(videoLimit);

    if (watchedCount > videoLimit) {
        statePillElement.textContent = "Limit dosiahnuty";
        statePillElement.dataset.state = "danger";
        sessionCaptionElement.textContent = "Cinder teraz brzdi dalsie video";
        return;
    }

    if (watchedCount === videoLimit) {
        statePillElement.textContent = "Cas na pauzu";
        statePillElement.dataset.state = "warning";
        sessionCaptionElement.textContent = "Dalsie video spusti blok";
        return;
    }

    if (remainingCount <= 2) {
        statePillElement.textContent = "Blizis sa k limitu";
        statePillElement.dataset.state = "warning";
        sessionCaptionElement.textContent = "Este mas chvilu priestoru";
        return;
    }

    statePillElement.textContent = "V pohode";
    statePillElement.dataset.state = "success";
    sessionCaptionElement.textContent = "Dnesna seria";
};

const loadSettings = () => {
    chrome.storage.local.get(
        [STORAGE_KEYS.videoLimit, STORAGE_KEYS.watchedCount],
        (result) => {
            currentState = {
                videoLimit: normalizeLimit(result[STORAGE_KEYS.videoLimit]),
                watchedCount: normalizeCount(result[STORAGE_KEYS.watchedCount])
            };

            renderState();
        }
    );
};

form.addEventListener("submit", (event) => {
    event.preventDefault();

    const limitValue = Number(limitInput.value);

    if (!Number.isInteger(limitValue) || limitValue < 1) {
        setStatus("Zadaj cele cislo vacsie ako 0.", "danger");
        return;
    }

    chrome.storage.local.set({ [STORAGE_KEYS.videoLimit]: limitValue }, () => {
        currentState.videoLimit = limitValue;
        renderState();
        setStatus("Limit je ulozeny.", "success");
    });
});

resetButton.addEventListener("click", () => {
    chrome.storage.local.set({ [STORAGE_KEYS.watchedCount]: 0 }, () => {
        currentState.watchedCount = 0;
        renderState();
        setStatus("Seria je resetovana.", "success");
    });
});

presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
        limitInput.value = button.dataset.limit;
        updatePresetButtons(Number(button.dataset.limit));
        setStatus("Vybrany limit je pripraveny. Staci ulozit.", "warning");
    });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
        return;
    }

    let hasRelevantChange = false;

    if (changes[STORAGE_KEYS.videoLimit]) {
        currentState.videoLimit = normalizeLimit(changes[STORAGE_KEYS.videoLimit].newValue);
        hasRelevantChange = true;
    }

    if (changes[STORAGE_KEYS.watchedCount]) {
        currentState.watchedCount = normalizeCount(changes[STORAGE_KEYS.watchedCount].newValue);
        hasRelevantChange = true;
    }

    if (hasRelevantChange) {
        renderState();
    }
});

loadSettings();
