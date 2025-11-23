// --- Global variables ---
let player;
let trimSlider; // Will hold the noUiSlider instance
let isYtApiReady = false; // Flag to track if the YouTube API is loaded

const dom = {
    urlInput: document.getElementById("url"),
    formatSelect: document.getElementById("format"),
    audioQuality: document.getElementById("audio-quality"),
    videoQuality: document.getElementById("video-quality"),
    status: document.getElementById("status"),
    modal: document.getElementById("modal"),
    agreeCheck: document.getElementById("agree"),
    previewCard: document.getElementById("preview-card"),
    // Corrected elements for the player and trim controls based on updated index.html
    playerContainer: document.getElementById("player-container"), // Container for the YouTube player
    trimSection: document.getElementById("trim-section"), // The fieldset for trim options
    trimSliderEl: document.getElementById("trim-slider"), // Element for the noUiSlider
    startTimeDisplay: document.getElementById("start-time-display"), // Display for start time
    endTimeDisplay: document.getElementById("end-time-display"), // Display for end time
    startTimeInput: document.getElementById("start-time"), // Hidden input for start time
    endTimeInput: document.getElementById("end-time"), // Hidden input for end time
    themeToggle: document.getElementById("themeToggle")
};


// --- Load YouTube IFrame API ---
// This code asynchronously loads the IFrame Player API.
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
const firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);


/**
 * This function is called automatically by the YouTube IFrame API script
 * once it has fully loaded and is ready to be used.
 */
function onYouTubeIframeAPIReady() {
    isYtApiReady = true;
    // If the user already pasted a URL before the API was ready, let's load the player now.
    const videoId = extractYouTubeVideoId(dom.urlInput.value);
    if (videoId) {
        loadPlayer(videoId);
    }
}


// --- Core Functions ---

/**
 * Toggles visibility of quality dropdowns based on selected format.
 */
function toggleQuality() {
    const format = dom.formatSelect.value;
    dom.audioQuality.classList.toggle("hidden", format !== "mp3");
    dom.videoQuality.classList.toggle("hidden", format !== "mp4");
}

/**
 * Opens the download confirmation modal if URL is valid.
 */
function openModal() {
    if (!dom.urlInput.value) {
        showMessage("Please enter a YouTube URL.");
        return;
    }
    dom.modal.classList.remove("hidden");
}

/**
 * Closes the download confirmation modal.
 */
function closeModal() {
    dom.modal.classList.add("hidden");
    dom.agreeCheck.checked = false;
}

/**
 * Formats seconds into a MM:SS or HH:MM:SS string.
 * @param {number} seconds - The total seconds.
 * @returns {string} The formatted time string.
 */
function formatTime(seconds) {
    seconds = Math.round(seconds);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (num) => num.toString().padStart(2, '0');

    if (h > 0) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
}

/**
 * Parses a time string (HH:MM:SS or MM:SS) into seconds.
 * @param {string} timeStr - The time string.
 * @returns {number} The time in seconds.
 */
function parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    }
    return 0; // Invalid format
}


/**
 * Handles the main download request to the backend.
 */
async function proceedDownload() {
    if (!dom.agreeCheck.checked) {
        showMessage("You must confirm your legal right to download.");
        return;
    }

    closeModal();
    dom.status.textContent = "Processing...";

    // Get start and end times from the hidden input fields, which are updated by the slider
    const startTime = dom.startTimeInput.value;
    const endTime = dom.endTimeInput.value;

    try {
        const response = await fetch("/download", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                url: dom.urlInput.value,
                format: dom.formatSelect.value,
                quality: dom.formatSelect.value === "mp3" ? dom.audioQuality.value : dom.videoQuality.value,
                startTime: startTime,
                endTime: endTime
            })
        });

        if (response.ok) {
            const blob = await response.blob();
            const contentDisposition = response.headers.get("Content-Disposition");
            const filenameMatch = contentDisposition?.match(/filename\*?=['"]?([^"';\n]*)/i);
            const filename = filenameMatch ? decodeURIComponent(filenameMatch[1]) : "download";

            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename.replace(/["']/g, "");
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
            dom.status.textContent = "Download ready!";
        } else {
            const err = await response.json();
            dom.status.textContent = `Error: ${err.error || "Unknown error occurred."}`;
        }
    } catch (error) {
        console.error("Download fetch error:", error);
        dom.status.textContent = "Error: Network issue or server unreachable.";
    }
}

/**
 * Extracts YouTube video ID from various URL formats.
 * @param {string} url - The YouTube URL.
 * @returns {string|null} The video ID or null.
 */
function extractYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:.*[?&]v=|v\/|embed\/|live\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([a-zA-Z0-9_-]{11}|[0-9a-zA-Z_-]{10,})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * Creates or updates the YouTube IFrame Player.
 * @param {string} videoId - The ID of the video to load.
 */
function loadPlayer(videoId) {
    // Ensure the player container is ready and has a child div with id 'player'
    // This div is where the YouTube iframe will be embedded.
    let playerDiv = document.getElementById('player');
    if (!playerDiv) {
        playerDiv = document.createElement('div');
        playerDiv.id = 'player';
        dom.playerContainer.innerHTML = ''; // Clear previous content if any
        dom.playerContainer.appendChild(playerDiv);
    }

    if (player && typeof player.loadVideoById === 'function') {
        // If player already exists, just load the new video.
        player.loadVideoById(videoId);
    } else {
        // If no player exists, create a new one.
        player = new YT.Player('player', {
            height: '100%', // Make player responsive within its container
            width: '100%',  // Make player responsive within its container
            videoId: videoId,
            playerVars: {
                'playsinline': 1, // Plays inline on mobile
                'rel': 0, // Do not show related videos
                'origin': window.location.origin // Crucial for cross-origin communication
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
}

/**
 * A robust function to set up or reset the trimmer UI.
 */
function setupTrimmer() {
    if (!player || typeof player.getDuration !== 'function') {
        console.error("setupTrimmer called but player is not ready.");
        dom.trimSection.disabled = true; // Keep trim section disabled if player not ready
        return;
    }
    const duration = player.getDuration();
    if (duration > 0) {
        dom.trimSection.disabled = false; // Enable trim section
        initializeTrimSlider(duration);
    } else {
        dom.trimSection.disabled = true; // Disable if duration is zero or unavailable
        if (trimSlider && trimSlider.destroy) {
            trimSlider.destroy();
            trimSlider = null;
        }
    }
}

/**
 * Event handler for when the player is first ready.
 * @param {object} event - The player ready event.
 */
function onPlayerReady(event) {
    // Attempt to set up trimmer once the player is ready
    setupTrimmer();
}

/**
 * Event handler for when the player's state changes.
 * This is crucial for re-initializing the slider when a new video is loaded.
 * @param {object} event - The state change event.
 */
function onPlayerStateChange(event) {
    // When a new video is loaded, its state becomes 5 (VIDEO_CUED).
    // Or if the video starts playing and duration was not available before.
    if (event.data === YT.PlayerState.VIDEO_CUED || (event.data === YT.PlayerState.PLAYING && player.getDuration() > 0)) {
        setupTrimmer();
    }
}

/**
 * Initializes the noUiSlider for trimming.
 * @param {number} duration - The total duration of the video in seconds.
 */
function initializeTrimSlider(duration) {
    // Destroy existing slider if it exists to prevent re-initialization errors
    if (trimSlider && trimSlider.destroy) {
        trimSlider.destroy();
    }

    // Create the slider on the element with id 'trim-slider'
    trimSlider = noUiSlider.create(dom.trimSliderEl, {
        start: [0, duration], // Initial range from 0 to full duration
        connect: true, // Connect the handles with a bar
        range: {
            'min': 0,
            'max': duration
        },
        // Display tooltips with formatted time for both handles
        tooltips: [
            { to: formatTime },
            { to: formatTime }
        ]
    });

    // Update display and seek video on slider 'slide' event (while dragging)
    trimSlider.on('slide', (values) => {
        const [start, end] = values;
        dom.startTimeDisplay.textContent = formatTime(start);
        dom.endTimeDisplay.textContent = formatTime(end);
        player.seekTo(parseFloat(start), true); // Seek to the start of the trimmed section
    });

    // Update hidden input fields on slider 'change' event (when dragging stops)
    trimSlider.on('change', (values) => {
        const [start, end] = values; // Values are numbers (seconds)
        // Set the hidden input values with formatted time strings
        dom.startTimeInput.value = (parseFloat(start) > 0) ? formatTime(start) : "";
        dom.endTimeInput.value = (parseFloat(end) < duration) ? formatTime(end) : "";
    });
    
    // Set initial display values and clear hidden inputs
    const [startVal, endVal] = trimSlider.get();
    dom.startTimeDisplay.textContent = formatTime(startVal);
    dom.endTimeDisplay.textContent = formatTime(endVal);
    dom.startTimeInput.value = ""; // Clear initially as it's full duration
    dom.endTimeInput.value = "";   // Clear initially as it's full duration
}

/**
 * Main handler for URL input changes.
 */
function handleUrlChange() {
    const url = dom.urlInput.value;
    const videoId = extractYouTubeVideoId(url);

    if (videoId) {
        dom.previewCard.classList.remove('hidden');
        // If API is ready, load the player. Otherwise, it will be loaded by onYouTubeIframeAPIReady().
        if (isYtApiReady) {
            loadPlayer(videoId);
        }
        // No direct enabling of trimSection here, it will be enabled by setupTrimmer after player is ready.
    } else {
        dom.previewCard.classList.add('hidden');
        dom.trimSection.disabled = true; // Disable trim section if no valid URL
        if (player && typeof player.destroy === 'function') {
            player.destroy();
            player = null;
        }
        if (trimSlider && typeof trimSlider.destroy === 'function') {
            trimSlider.destroy();
            trimSlider = null;
        }
        // Clear the player container HTML if no valid video is present
        dom.playerContainer.innerHTML = '';
        // Also clear trim time displays and hidden inputs
        dom.startTimeDisplay.textContent = "00:00";
        dom.endTimeDisplay.textContent = "00:00";
        dom.startTimeInput.value = "";
        dom.endTimeInput.value = "";
    }
}


/**
 * Displays a custom message box.
 * @param {string} message - The message to display.
 */
function showMessage(message) {
    dom.status.textContent = message;
    dom.status.style.color = "red";
    setTimeout(() => {
        dom.status.textContent = "";
        dom.status.style.color = "";
    }, 3000);
}

// --- Event Listeners ---
dom.urlInput.addEventListener("input", handleUrlChange);
dom.themeToggle.addEventListener("change", function () {
    document.body.classList.toggle("dark", this.checked);
    document.documentElement.classList.toggle("dark", this.checked); // Apply to html element for scrollbar
});

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Set initial theme based on user preference or default to light
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");
    if (prefersDarkScheme.matches) {
        document.body.classList.add("dark");
        document.documentElement.classList.add("dark");
        dom.themeToggle.checked = true;
    } else {
        document.body.classList.remove("dark");
        document.documentElement.classList.remove("dark");
        dom.themeToggle.checked = false;
    }
    toggleQuality();
    dom.trimSection.disabled = true; // Ensure trim section is disabled initially
});
