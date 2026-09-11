// Get elements
const saveButton = document.getElementById("saveBtn");
const timestampDisplay = document.getElementById("timestampDisplay");
const timestampList = document.getElementById("timestampList");
const categoryFilter = document.getElementById("categoryFilter");
const newCategoryInput = document.getElementById("newCategoryInput");
const addCategoryBtn = document.getElementById("addCategoryBtn");

let currentCategory = "All";

// Render initial state
init();

async function init() {
  await renderCategories();
  renderTimestamps();
}

// Add click handler for main save button
saveButton.addEventListener("click", async () => {
  try {
    chrome.runtime.sendMessage(
      { action: "saveTimestampFromPopup" },
      (response) => {
        if (chrome.runtime.lastError) {
          displayMessage("Could not communicate with background script.", "error");
          return;
        }
      },
    );
  } catch (error) {
    displayMessage("Error: " + error.message, "error");
  }
});

// Add category button handler
addCategoryBtn.addEventListener("click", () => {
  const name = newCategoryInput.value.trim();
  if (name) {
    addCategory(name);
  }
});

newCategoryInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const name = newCategoryInput.value.trim();
    if (name) addCategory(name);
  }
});

function addCategory(name) {
  chrome.storage.local.get(["categories"], (result) => {
    const categories = result.categories || ["Default"];
    if (categories.includes(name)) {
      displayMessage("Category already exists", "error");
      return;
    }
    const updatedCategories = [...categories, name];
    chrome.storage.local.set({ categories: updatedCategories }, () => {
      newCategoryInput.value = "";
      displayMessage("Category added", "success");
      renderCategories();
    });
  });
}

function deleteCategory(name) {
  if (name === "Default" || name === "All") return;

  chrome.storage.local.get(["categories", "savedTimestamps"], (result) => {
    const categories = result.categories || ["Default"];
    const timestamps = result.savedTimestamps || [];
    
    const updatedCategories = categories.filter(c => c !== name);
    const updatedTimestamps = timestamps.map(ts => {
      if (ts.category === name) {
        return { ...ts, category: "Default" };
      }
      return ts;
    });

    chrome.storage.local.set({ 
      categories: updatedCategories,
      savedTimestamps: updatedTimestamps 
    }, () => {
      displayMessage("Category deleted", "success");
      if (currentCategory === name) {
        currentCategory = "All";
      }
      renderCategories();
      renderTimestamps();
    });
  });
}

async function renderCategories() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["categories", "savedTimestamps"], (result) => {
      const categories = result.categories || ["Default"];
      const timestamps = result.savedTimestamps || [];
      
      const categoryList = ["All", ...categories];
      
      categoryFilter.innerHTML = categoryList.map(cat => {
        const isActive = cat === currentCategory;
        const isDeletable = cat !== "All" && cat !== "Default";
        
        // Calculate count
        let count = 0;
        if (cat === "All") {
          count = timestamps.length;
        } else {
          count = timestamps.filter(ts => (ts.category || "Default") === cat).length;
        }
        
        return `
          <div class="category-chip ${isActive ? 'active' : ''}" data-name="${cat}">
            ${cat} <span class="cat-count">(${count})</span>
            ${isDeletable ? `<span class="delete-cat-btn" data-name="${cat}">×</span>` : ''}
          </div>
        `;
      }).join("");

      // Add listeners
      categoryFilter.querySelectorAll(".category-chip").forEach(chip => {
        chip.addEventListener("click", () => {
          currentCategory = chip.dataset.name;
          renderCategories();
          renderTimestamps();
        });
      });

      categoryFilter.querySelectorAll(".delete-cat-btn").forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteCategory(btn.dataset.name);
        });
      });
      
      resolve();
    });
  });
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "timestampSaved") {
    renderTimestamps();
    renderCategories(); // Also refresh counts
  }
});

// Helper function to remove existing timestamp parameter from URL
function removeExistingTimestampParam(url) {
  const [baseUrl, queryString] = url.split("?");
  if (!queryString) return url;
  const params = queryString.split("&").filter((param) => !param.startsWith("t="));
  return params.length > 0 ? baseUrl + "?" + params.join("&") : baseUrl;
}

// Handle delete button clicks
function handleDeleteClick(event) {
  const timestampId = parseInt(event.target.dataset.id);
  deleteTimestamp(timestampId);
}

// Delete a timestamp from storage
function deleteTimestamp(timestampId) {
  chrome.storage.local.get(["savedTimestamps"], (result) => {
    const timestamps = result.savedTimestamps || [];
    const updatedTimestamps = timestamps.filter((ts) => ts.id !== timestampId);

    chrome.storage.local.set({ savedTimestamps: updatedTimestamps }, () => {
      if (chrome.runtime.lastError) {
        displayMessage("Failed to delete timestamp", "error");
      } else {
        displayMessage("Timestamp deleted", "success");
        renderTimestamps();
        renderCategories(); // Also refresh counts
      }
    });
  });
}

// Helper function to format date as DD/MM/YY HH:MM (24h)
function formatDate(dateString) {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function renderTimestamps() {
  chrome.storage.local.get(["savedTimestamps"], (result) => {
    let timestamps = result.savedTimestamps || [];

    // Filter by category
    if (currentCategory !== "All") {
      timestamps = timestamps.filter(ts => (ts.category || "Default") === currentCategory);
    }

    if (timestamps.length === 0) {
      timestampList.innerHTML = `<p>No timestamps in ${currentCategory}.</p>`;
    } else {
      const sortedTimestamps = timestamps
        .slice()
        .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

      const timestampItems = sortedTimestamps
        .map((ts) => {
          const timeInSeconds = Math.floor(ts.currentTime);
          const cleanUrl = removeExistingTimestampParam(ts.url);
          const separator = cleanUrl.includes("?") ? "&" : "?";
          const timestampUrl = `${cleanUrl}${separator}t=${timeInSeconds}`;
          const thumbUrl = ts.thumbnailUrl || (ts.videoId ? `https://img.youtube.com/vi/${ts.videoId}/mqdefault.jpg` : null);

          return `
        <div class="timestamp-item" data-url="${timestampUrl}">
          <button class="delete-btn" data-id="${ts.id}" title="Delete timestamp">×</button>
          ${thumbUrl ? `<img src="${thumbUrl}" class="timestamp-thumbnail" alt="Video thumbnail">` : ""}
          <div class="timestamp-info">
            <div class="timestamp-title">${ts.title}</div>
            <div class="timestamp-time">${ts.formattedTime} / ${ts.formattedDuration}</div>
            <div class="timestamp-saved">${formatDate(ts.savedAt)}</div>
          </div>
        </div>
      `;
        })
        .join("");

      timestampList.innerHTML = timestampItems;

      // Add event listeners for delete buttons
      const deleteButtons = timestampList.querySelectorAll(".delete-btn");
      deleteButtons.forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          handleDeleteClick(event);
        });
      });

      // Add event listeners for entire timestamp tiles
      const items = timestampList.querySelectorAll(".timestamp-item");
      items.forEach((item) => {
        item.addEventListener("click", (event) => {
          const url = item.dataset.url;
          if (url) {
            chrome.tabs.create({ url: url });
          }
        });
      });
    }
  });
}

function displayMessage(message, type) {
  timestampDisplay.textContent = message;
  timestampDisplay.className = "message " + type;
  setTimeout(() => {
    timestampDisplay.textContent = "";
    timestampDisplay.className = "message";
  }, 4000);
}

// Enable/disable button based on current tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (tab && tab.url && tab.url.includes("youtube.com")) {
    saveButton.disabled = false;
  } else {
    saveButton.disabled = true;
  }
});

// Export functionality
exportCsvBtn.addEventListener("click", () => exportData("csv"));
exportTxtBtn.addEventListener("click", () => exportData("txt"));

function exportData(format) {
  chrome.storage.local.get(["savedTimestamps"], (result) => {
    const timestamps = result.savedTimestamps || [];
    if (timestamps.length === 0) {
      displayMessage("No data to export", "error");
      return;
    }

    // Sort by savedAt descending
    const sortedData = timestamps.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    const headers = [
      "S.No",
      "Title",
      "Video ID",
      "URL",
      "Timestamp (s)",
      "Formatted Time",
      "Duration (s)",
      "Formatted Duration",
      "Category",
      "Saved At"
    ];

    let content = "";
    const fileName = `youtube_timestamps_${new Date().toISOString().slice(0, 10)}`;

    if (format === "csv") {
      content = headers.map(h => `"${h}"`).join(",") + "\n";
      content += sortedData.map((ts, index) => {
        return [
          index + 1,
          ts.title || "",
          ts.videoId || "",
          ts.url || "",
          ts.currentTime || 0,
          ts.formattedTime || "",
          ts.duration || 0,
          ts.formattedDuration || "",
          ts.category || "Default",
          ts.savedAt || ""
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
      }).join("\n");
      downloadFile(content, `${fileName}.csv`, "text/csv");
    } else {
      content = headers.join("\t") + "\n";
      content += sortedData.map((ts, index) => {
        return [
          index + 1,
          ts.title || "",
          ts.videoId || "",
          ts.url || "",
          ts.currentTime || 0,
          ts.formattedTime || "",
          ts.duration || 0,
          ts.formattedDuration || "",
          ts.category || "Default",
          ts.savedAt || ""
        ].join("\t");
      }).join("\n");
      downloadFile(content, `${fileName}.txt`, "text/plain");
    }
  });
}

function downloadFile(content, fileName, contentType) {
  console.log("Preparing download for:", fileName);
  const blob = new Blob([content], { type: contentType });
  const reader = new FileReader();
  
  reader.onload = function() {
    console.log("Data URL prepared, calling chrome.downloads.download");
    chrome.downloads.download({
      url: reader.result,
      filename: fileName,
      saveAs: true
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error("Download error:", chrome.runtime.lastError);
        displayMessage("Export cancelled or failed", "error");
      } else {
        console.log("Download started with ID:", downloadId);
        displayMessage(`Exporting ${fileName}...`, "success");
      }
    });
  };
  
  reader.onerror = function(error) {
    console.error("FileReader error:", error);
  };
  
  reader.readAsDataURL(blob);
}
