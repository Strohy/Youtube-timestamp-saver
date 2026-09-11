# YouTube Timestamp Saver

A lightweight Chrome extension to capture and save timestamps of YouTube videos instantly. Never miss a key moment in a tutorial, lecture, or music video again!

## Features

- **One-Click Save:** Instantly save the current video time, title, and URL.
- **Keyboard Shortcut:** Press **Alt + X** (Windows/Linux) or **Option + X** (Mac) to save a timestamp without opening any menus.
- **Visual Feedback:** A non-intrusive "Saved!" notification appears directly on the YouTube player.
- **Manage History:** View your saved timestamps in a clean list, delete old entries, or click a link to jump back to the exact second in the video.
- **Auto-Update:** If you save a new timestamp for a video you've already saved, it automatically updates to the most recent one.

## Getting Started

### 1. Download the Repository
1. Click the green **"Code"** button at the top of this page.
2. Select **"Download ZIP"** and extract the files to a folder on your computer.
   * *Alternatively, if you have Git installed, run:*
     ```bash
     git clone https://github.com/Harsh-Chugh/Youtube-timestamp-saver.git
     ```

### 2. Install in Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. In the top-right corner, toggle **"Developer mode"** to **ON**.
3. Click the **"Load unpacked"** button in the top-left corner.
4. Select the folder where you downloaded/extracted the extension files (the folder containing `manifest.json`).

## How to Use

1. **Navigate to YouTube:** Open any YouTube video.
2. **Save a Timestamp:**
   * **Method A:** Press **Alt + S** (Win) or **Option + S** (Mac). A notification will appear in the top-right of the video.
   * **Method B:** Click the extension icon in your toolbar and click the **"Save Timestamp"** button.
3. **View Your Saved Times:** Click the extension icon and select **"View Saved Timestamps"**.
4. **Jump Back:** Click the video title or URL in the list to open the video at that exact saved second!

## Permissions
- `activeTab`: To capture the timestamp of the video you are currently watching.
- `storage`: To save your timestamps locally on your browser.
- `scripting`: To communicate with the YouTube video player.

---
Built for better YouTube learning.
