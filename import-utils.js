(function (root) {
  "use strict";

  const CSV_HEADERS = [
    "S.No",
    "Title",
    "Video ID",
    "URL",
    "Timestamp (s)",
    "Formatted Time",
    "Duration (s)",
    "Formatted Duration",
    "Category",
    "Saved At",
  ];

  function parseCsv(text) {
    if (typeof text !== "string") {
      throw new Error("The selected file could not be read as text.");
    }

    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (inQuotes) {
        if (character === '"') {
          if (text[index + 1] === '"') {
            field += '"';
            index += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"' && field === "") {
        inQuotes = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && text[index + 1] === "\n") {
          index += 1;
        }
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    if (inQuotes) {
      throw new Error("The CSV contains an unfinished quoted field.");
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function formatTime(seconds) {
    const wholeSeconds = Math.floor(seconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const remainingSeconds = wholeSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function isYouTubeUrl(value) {
    try {
      const url = new URL(value);
      const hostname = url.hostname.toLowerCase();
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        (hostname === "youtube.com" ||
          hostname.endsWith(".youtube.com") ||
          hostname === "youtu.be")
      );
    } catch (_error) {
      return false;
    }
  }

  function normalizeRow(row, importedAt) {
    if (row.length !== CSV_HEADERS.length) return null;

    const videoId = row[2].trim();
    const url = row[3].trim();
    const currentTime = Number(row[4]);
    const duration = Number(row[6]);

    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
    if (!isYouTubeUrl(url)) return null;
    if (!Number.isFinite(currentTime) || currentTime < 0) return null;
    if (!Number.isFinite(duration) || duration < 0) return null;

    const savedAtValue = row[9].trim();
    const savedAt = savedAtValue && !Number.isNaN(Date.parse(savedAtValue))
      ? savedAtValue
      : importedAt;

    return {
      title: row[1],
      videoId,
      url,
      currentTime,
      formattedTime: row[5].trim() || formatTime(currentTime),
      duration,
      formattedDuration: row[7].trim() || formatTime(duration),
      category: row[8].trim() || "Default",
      savedAt,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    };
  }

  function prepareCsvImport(text, existingTimestamps, existingCategories, importedAt) {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      throw new Error("The CSV file is empty.");
    }

    rows[0][0] = rows[0][0].replace(/^\uFEFF/, "");
    const headersMatch =
      rows[0].length === CSV_HEADERS.length &&
      CSV_HEADERS.every((header, index) => rows[0][index].trim() === header);

    if (!headersMatch) {
      throw new Error("This CSV does not match the YouTube Timestamp Saver export format.");
    }

    const timestamps = Array.isArray(existingTimestamps)
      ? existingTimestamps.slice()
      : [];
    const categories = Array.isArray(existingCategories)
      ? existingCategories.filter((category) => typeof category === "string" && category.trim())
      : [];
    if (!categories.includes("Default")) categories.unshift("Default");

    const categorySet = new Set(categories);
    const timestampIndexes = new Map();
    const usedIds = new Set();

    timestamps.forEach((timestamp, index) => {
      if (timestamp && timestamp.videoId) timestampIndexes.set(timestamp.videoId, index);
      if (timestamp && Number.isFinite(timestamp.id)) usedIds.add(timestamp.id);
    });

    let nextId = Date.now();
    const getNextId = () => {
      while (usedIds.has(nextId)) nextId += 1;
      const id = nextId;
      usedIds.add(id);
      nextId += 1;
      return id;
    };

    let imported = 0;
    let overwritten = 0;
    let skipped = 0;
    const fallbackDate = importedAt || new Date().toISOString();

    rows.slice(1).forEach((row) => {
      if (row.length === 1 && row[0].trim() === "") return;

      const timestamp = normalizeRow(row, fallbackDate);
      if (!timestamp) {
        skipped += 1;
        return;
      }

      if (!categorySet.has(timestamp.category)) {
        categorySet.add(timestamp.category);
        categories.push(timestamp.category);
      }

      const existingIndex = timestampIndexes.get(timestamp.videoId);
      if (existingIndex !== undefined) {
        const existing = timestamps[existingIndex];
        timestamps[existingIndex] = {
          ...timestamp,
          id: Number.isFinite(existing.id) ? existing.id : getNextId(),
        };
        overwritten += 1;
      } else {
        timestampIndexes.set(timestamp.videoId, timestamps.length);
        timestamps.push({ ...timestamp, id: getNextId() });
        imported += 1;
      }
    });

    return { timestamps, categories, imported, overwritten, skipped };
  }

  const api = { CSV_HEADERS, parseCsv, prepareCsvImport };
  root.TimestampCsvImport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
