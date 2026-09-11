// Function to extract YouTube Video ID
function getVideoId(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1);
    }
    
    // Handle standard watch URLs
    const params = new URLSearchParams(urlObj.search);
    const v = params.get("v");
    if (v) return v;

    // Handle Shorts URLs (/shorts/VIDEO_ID)
    if (urlObj.pathname.startsWith("/shorts/")) {
      return urlObj.pathname.split("/")[2];
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTimestamp") {
    try {
      // Get the video element on YouTube
      const video = document.querySelector("video");

      if (!video) {
        console.error("No video element found on this page");
        sendResponse({
          success: false,
          error:
            "No video element found. Make sure you're on a YouTube video page.",
        });
        return;
      }

      // Get current time and duration in seconds
      const currentTime = video.currentTime;
      const duration = video.duration;

      // Format time as H:MM:SS or MM:SS
      const formatTime = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hrs > 0) {
          return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
            .toString()
            .padStart(2, "0")}`;
        }
        return `${mins}:${secs.toString().padStart(2, "0")}`;
      };

      const videoId = getVideoId(window.location.href);
      const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;

      const timestamp = {
        videoId: videoId,
        thumbnailUrl: thumbnailUrl,
        currentTime: currentTime,
        formattedTime: formatTime(currentTime),
        duration: duration,
        formattedDuration: formatTime(duration),
        url: window.location.href,
        title: document.title,
      };

      console.log("YouTube Timestamp Saved:", timestamp);

      sendResponse({
        success: true,
        timestamp: timestamp,
      });
    } catch (error) {
      console.error("Error capturing timestamp:", error);
      sendResponse({
        success: false,
        error: error.message,
      });
    }
  } else if (request.action === "showToast") {
    showToast(request.text, request.type);
    sendResponse({ success: true });
  } else if (request.action === "showCategoryModal") {
    showCategoryModal(request.categories, (category) => {
      sendResponse({ success: true, category: category });
    });
    return true; // Keep message channel open for async response
  }
});

// Function to show category selection modal
function showCategoryModal(categories, callback) {
  // Remove existing modal if any
  const existingModal = document.getElementById("yt-timestamp-category-modal");
  if (existingModal) {
    existingModal.remove();
  }

  // Create modal elements
  const overlay = document.createElement("div");
  overlay.id = "yt-timestamp-category-modal";
  overlay.className = "yt-category-modal-overlay";

  const container = document.createElement("div");
  container.className = "yt-category-modal-container";

  const title = document.createElement("h3");
  title.textContent = "Select Category";
  container.appendChild(title);

  const categoryList = document.createElement("div");
  categoryList.className = "yt-category-list";

  let selectedCategory = "Default";

  categories.forEach((cat) => {
    const item = document.createElement("div");
    item.className = "yt-category-item" + (cat === "Default" ? " selected" : "");
    item.textContent = cat;
    item.onclick = () => {
      document.querySelectorAll(".yt-category-item").forEach(i => i.classList.remove("selected"));
      item.classList.add("selected");
      selectedCategory = cat;
    };
    categoryList.appendChild(item);
  });

  container.appendChild(categoryList);

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "yt-modal-buttons";

  const saveBtn = document.createElement("button");
  saveBtn.className = "yt-modal-btn save";
  saveBtn.textContent = "SAVE";
  saveBtn.onclick = () => {
    overlay.remove();
    callback(selectedCategory);
  };

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "yt-modal-btn cancel";
  cancelBtn.textContent = "CANCEL";
  cancelBtn.onclick = () => {
    overlay.remove();
  };

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(saveBtn);
  container.appendChild(buttonContainer);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
}

// Function to show a toast notification on the page
function showToast(message, type = "success") {
  // Remove existing toast if any
  const existingToast = document.getElementById("yt-timestamp-saver-toast");
  if (existingToast) {
    existingToast.remove();
  }

  // Create toast element
  const toast = document.createElement("div");
  toast.id = "yt-timestamp-saver-toast";
  toast.className = `yt-timestamp-saver-toast ${type}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
