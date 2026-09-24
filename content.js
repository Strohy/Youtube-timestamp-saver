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
    showCategoryModal(request.categories, (result) => {
      sendResponse(result);
    });
    return true; // Keep message channel open for async response
  }
});

let activeCategoryModal = null;

// Function to show category selection modal
function showCategoryModal(categories, callback) {
  // Complete any pending request before replacing its modal.
  if (activeCategoryModal) {
    activeCategoryModal.close({ success: false, cancelled: true });
  }

  const normalizedCategories = Array.from(
    new Set(
      (Array.isArray(categories) ? categories : [])
        .filter((category) => typeof category === "string")
        .map((category) => category.trim())
        .filter(Boolean),
    ),
  );

  if (normalizedCategories.length === 0) {
    normalizedCategories.push("Default");
  }

  const previouslyFocused = document.activeElement;
  let selectedIndex = normalizedCategories.indexOf("Default");
  if (selectedIndex === -1) selectedIndex = 0;
  let isClosed = false;

  // Create modal elements
  const overlay = document.createElement("div");
  overlay.id = "yt-timestamp-category-modal";
  overlay.className = "yt-category-modal-overlay";

  const container = document.createElement("div");
  container.className = "yt-category-modal-container";
  container.setAttribute("role", "dialog");
  container.setAttribute("aria-modal", "true");
  container.setAttribute("aria-labelledby", "yt-category-modal-title");

  const title = document.createElement("h3");
  title.id = "yt-category-modal-title";
  title.textContent = "Select Category";
  container.appendChild(title);

  const categoryList = document.createElement("div");
  categoryList.className = "yt-category-list";
  categoryList.setAttribute("role", "radiogroup");
  categoryList.setAttribute("aria-labelledby", title.id);

  const categoryItems = normalizedCategories.map((cat, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "yt-category-item";
    item.setAttribute("role", "radio");
    item.setAttribute("aria-checked", "false");
    item.tabIndex = -1;
    item.textContent = cat;
    item.onclick = () => {
      selectCategory(index, true);
    };
    categoryList.appendChild(item);
    return item;
  });

  container.appendChild(categoryList);

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "yt-modal-buttons";

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "yt-modal-btn save";
  saveBtn.textContent = "SAVE";
  saveBtn.onclick = saveSelection;

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "yt-modal-btn cancel";
  cancelBtn.textContent = "CANCEL";
  cancelBtn.onclick = cancelSelection;

  buttonContainer.appendChild(cancelBtn);
  buttonContainer.appendChild(saveBtn);
  container.appendChild(buttonContainer);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  function selectCategory(index, shouldFocus = false) {
    selectedIndex = index;

    categoryItems.forEach((item, itemIndex) => {
      const isSelected = itemIndex === selectedIndex;
      item.classList.toggle("selected", isSelected);
      item.setAttribute("aria-checked", String(isSelected));
      item.tabIndex = isSelected ? 0 : -1;
    });

    if (shouldFocus) {
      categoryItems[selectedIndex].focus();
    }
  }

  function moveSelection(offset) {
    const nextIndex =
      (selectedIndex + offset + categoryItems.length) % categoryItems.length;
    selectCategory(nextIndex, true);
  }

  function saveSelection() {
    closeModal({
      success: true,
      category: normalizedCategories[selectedIndex],
    });
  }

  function cancelSelection() {
    closeModal({ success: false, cancelled: true });
  }

  function closeModal(result) {
    if (isClosed) return;
    isClosed = true;

    overlay.removeEventListener("keydown", handleKeydown, true);
    overlay.remove();

    if (activeCategoryModal?.close === closeModal) {
      activeCategoryModal = null;
    }

    if (
      previouslyFocused instanceof HTMLElement &&
      previouslyFocused.isConnected
    ) {
      previouslyFocused.focus();
    }

    callback(result);
  }

  function handleKeydown(event) {
    const target = event.target;
    const focusedCategoryIndex = categoryItems.indexOf(target);
    const isCategoryFocused = focusedCategoryIndex !== -1;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        event.stopPropagation();
        moveSelection(1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        event.stopPropagation();
        moveSelection(-1);
        break;
      case "Home":
        event.preventDefault();
        event.stopPropagation();
        selectCategory(0, true);
        break;
      case "End":
        event.preventDefault();
        event.stopPropagation();
        selectCategory(categoryItems.length - 1, true);
        break;
      case "Enter":
        event.preventDefault();
        event.stopPropagation();
        if (target === cancelBtn) {
          cancelSelection();
        } else {
          saveSelection();
        }
        break;
      case " ":
        event.preventDefault();
        event.stopPropagation();
        if (isCategoryFocused) {
          selectCategory(focusedCategoryIndex, true);
        } else if (target === cancelBtn) {
          cancelSelection();
        } else if (target === saveBtn) {
          saveSelection();
        }
        break;
      case "Esc":
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        cancelSelection();
        break;
      case "Tab": {
        const focusableElements = [
          categoryItems[selectedIndex],
          cancelBtn,
          saveBtn,
        ];
        const focusedIndex = focusableElements.indexOf(document.activeElement);
        const isLeavingStart = event.shiftKey && focusedIndex <= 0;
        const isLeavingEnd =
          !event.shiftKey && focusedIndex === focusableElements.length - 1;

        if (isLeavingStart || isLeavingEnd || focusedIndex === -1) {
          event.preventDefault();
          event.stopPropagation();
          const nextElement = event.shiftKey
            ? focusableElements[focusableElements.length - 1]
            : focusableElements[0];
          nextElement.focus();
        }
        break;
      }
    }
  }

  activeCategoryModal = { close: closeModal };
  overlay.addEventListener("keydown", handleKeydown, true);
  selectCategory(selectedIndex, true);
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
