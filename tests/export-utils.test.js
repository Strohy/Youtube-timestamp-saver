const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createTimestampUrl,
  formatReadableDate,
  formatTxtExport,
} = require("../export-utils.js");

test("creates a direct link at the saved timestamp", () => {
  const url = createTimestampUrl(
    "https://www.youtube.com/watch?v=abcdefghijk&t=10&list=example",
    754.9,
  );

  assert.equal(
    url,
    "https://www.youtube.com/watch?v=abcdefghijk&list=example&t=754",
  );
});

test("formats TXT exports as category sections with readable entries", () => {
  const exportedAt = "2026-09-25T09:00:00.000Z";
  const timestamps = [
    {
      title: "Older research video",
      videoId: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      currentTime: 320,
      formattedTime: "5:20",
      formattedDuration: "18:42",
      category: "Research",
      savedAt: "2026-09-22T12:10:00.000Z",
    },
    {
      title: "Interesting Interview",
      videoId: "lmnopqrstuv",
      url: "https://www.youtube.com/watch?v=lmnopqrstuv",
      currentTime: 3852,
      formattedTime: "1:04:12",
      formattedDuration: "2:10:30",
      category: "Default",
      savedAt: "2026-09-20T05:35:00.000Z",
    },
    {
      title: "How JavaScript\nWorks",
      videoId: "zyxwvutsrqp",
      url: "https://www.youtube.com/watch?v=zyxwvutsrqp",
      currentTime: 754,
      formattedTime: "12:34",
      formattedDuration: "45:10",
      category: "Research",
      savedAt: "2026-09-24T03:45:00.000Z",
    },
  ];

  const output = formatTxtExport(timestamps, exportedAt);

  assert.match(output, /^YOUTUBE TIMESTAMP SAVER/);
  assert.match(output, /Total timestamps: 3/);
  assert.match(output, /=== Research \(2\) ===/);
  assert.match(output, /=== Default \(1\) ===/);
  assert.match(output, /1\. How JavaScript Works/);
  assert.match(output, /Time: 12:34 of 45:10/);
  assert.match(output, /Saved: /);
  assert.match(output, /Link: https:\/\/www\.youtube\.com\/watch\?v=zyxwvutsrqp&t=754/);
  assert.ok(output.indexOf("How JavaScript Works") < output.indexOf("Older research video"));
  assert.ok(output.indexOf("=== Research") < output.indexOf("=== Default"));
  assert.ok(output.includes(`Exported: ${formatReadableDate(exportedAt)}`));
  assert.doesNotMatch(output, /Video ID|Timestamp \(s\)|Duration \(s\)/);
});
