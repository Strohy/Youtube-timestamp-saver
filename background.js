// Initialize storage on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["categories"], (result) => {
    if (!result.categories) {
      chrome.storage.local.set({ categories: ["Default"] });
    }
  });
});

// Listen for keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  if (command === "save-timestamp") {
    handleSaveTimestamp();
  }
});

// Function to handle the save timestamp logic
async function handleSaveTimestamp() {
  try {
    // Get the active tab
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    // Verify it's a YouTube tab
    if (!tab || !tab.url || !tab.url.includes("youtube.com")) {
      console.log("Not a YouTube tab or no active tab found.");
      return;
    }

    // Request timestamp from content script
    chrome.tabs.sendMessage(tab.id, { action: "getTimestamp" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error communicating with content script. Please refresh the YouTube page.",
          chrome.runtime.lastError
        );
        return;
      }

      if (response && response.success) {
        checkAndSave(response.timestamp, tab.id);
      } else {
        console.error("Failed to capture timestamp:", response?.error);
      }
    });
  } catch (error) {
    console.error("Error in background script:", error);
  }
}

// Function to check if timestamp exists and decide whether to show category modal
function checkAndSave(ts, tabId) {
  if (!ts.videoId) {
    console.error("No video ID found, cannot save timestamp.");
    chrome.tabs.sendMessage(tabId, { 
      action: "showToast", 
      text: "Error: Could not identify video ID", 
      type: "error" 
    });
    return;
  }

  chrome.storage.local.get(["savedTimestamps", "categories"], (result) => {
    const timestamps = result.savedTimestamps || [];
    const categories = result.categories || ["Default"];
    
    // Check if it's an update (same videoId)
    const existingIndex = timestamps.findIndex((t) => t.videoId === ts.videoId);
    
    if (existingIndex !== -1) {
      // It's an update, skip modal and use existing category
      const existingEntry = timestamps[existingIndex];
      saveToStorage(ts, tabId, existingEntry.category || "Default");
    } else {
      // New timestamp, ask for category
      chrome.tabs.sendMessage(tabId, { 
        action: "showCategoryModal", 
        categories: categories 
      }, (response) => {
        // If message fails or response is invalid, default to "Default"
        if (chrome.runtime.lastError || !response || !response.success) {
          console.warn("Category modal failed, using Default category.");
          saveToStorage(ts, tabId, "Default");
        } else {
          saveToStorage(ts, tabId, response.category);
        }
      });
    }
  });
}

// Function to save timestamp to local storage
function saveToStorage(ts, tabId, category) {
  chrome.storage.local.get(["savedTimestamps"], (result) => {
    const timestamps = result.savedTimestamps || [];

    // Check if it's an update (same videoId)
    const existingIndex = timestamps.findIndex((t) => t.videoId === ts.videoId);
    const isUpdate = existingIndex !== -1;

    let timestampEntry;

    if (isUpdate) {
      // Preserve original title, ID, and thumbnailUrl if it exists, update everything else
      const existingEntry = timestamps[existingIndex];
      timestampEntry = {
        ...ts,
        category: category,
        title: existingEntry.title, // Keep the first saved title
        thumbnailUrl: existingEntry.thumbnailUrl || ts.thumbnailUrl, // Keep existing or use new
        id: existingEntry.id, // Keep original ID
        savedAt: new Date().toISOString(), // Update time for sorting
      };

      // Remove the old entry so we can push the updated one to the end
      timestamps.splice(existingIndex, 1);
    } else {
      // New entry
      timestampEntry = {
        ...ts,
        category: category,
        savedAt: new Date().toISOString(),
        id: Date.now(),
      };
    }

    const updatedTimestamps = [...timestamps, timestampEntry];

    chrome.storage.local.set({ savedTimestamps: updatedTimestamps }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving to storage:", chrome.runtime.lastError);
      } else {
        const message = isUpdate ? "Timestamp Updated!" : "Timestamp Saved!";
        console.log(message);

        // Notify content script to show visual feedback (Toast)
        chrome.tabs.sendMessage(tabId, {
          action: "showToast",
          text: `${message} (${ts.formattedTime}) in ${category}`,
          type: "success",
        });

        // Notify popup to refresh its list if it's open
        chrome.runtime.sendMessage({ action: "timestampSaved" }).catch(() => {
          // Ignore error if popup is not open
        });
      }
    });
  });
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "saveTimestampFromPopup") {
    handleSaveTimestamp();
    sendResponse({ status: "processing" });
  }
  return true;
});
