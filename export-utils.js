(function (root) {
  "use strict";

  function cleanText(value, fallback) {
    const cleaned = String(value || "").replace(/\s+/g, " ").trim();
    return cleaned || fallback;
  }

  function formatReadableDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown";

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    }).format(date);
  }

  function createTimestampUrl(url, currentTime) {
    try {
      const timestampUrl = new URL(url);
      timestampUrl.searchParams.delete("t");
      timestampUrl.searchParams.set("t", String(Math.max(0, Math.floor(Number(currentTime) || 0))));
      return timestampUrl.toString();
    } catch (_error) {
      return cleanText(url, "Unavailable");
    }
  }

  function formatTxtExport(timestamps, exportedAt) {
    const sortedTimestamps = timestamps
      .slice()
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    const groups = new Map();

    sortedTimestamps.forEach((timestamp) => {
      const category = cleanText(timestamp.category, "Default");
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(timestamp);
    });

    const lines = [
      "YOUTUBE TIMESTAMP SAVER",
      `Exported: ${formatReadableDate(exportedAt)}`,
      `Total timestamps: ${sortedTimestamps.length}`,
      "",
    ];

    groups.forEach((categoryTimestamps, category) => {
      lines.push(`=== ${category} (${categoryTimestamps.length}) ===`, "");

      categoryTimestamps.forEach((timestamp, index) => {
        const title = cleanText(timestamp.title, "Untitled video");
        const formattedTime = cleanText(timestamp.formattedTime, "0:00");
        const formattedDuration = cleanText(timestamp.formattedDuration, "Unknown");

        lines.push(
          `${index + 1}. ${title}`,
          `   Time: ${formattedTime} of ${formattedDuration}`,
          `   Saved: ${formatReadableDate(timestamp.savedAt)}`,
          `   Link: ${createTimestampUrl(timestamp.url, timestamp.currentTime)}`,
          "",
        );
      });

      lines.push("");
    });

    return lines.join("\n").trimEnd() + "\n";
  }

  const api = { createTimestampUrl, formatReadableDate, formatTxtExport };
  root.TimestampExport = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
