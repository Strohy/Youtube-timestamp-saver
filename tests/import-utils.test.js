const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CSV_HEADERS,
  parseCsv,
  prepareCsvImport,
} = require("../import-utils.js");

function csvRow(values) {
  return values
    .map((value) => `"${String(value).replace(/"/g, '""')}"`)
    .join(",");
}

function csvFile(rows) {
  return [csvRow(CSV_HEADERS), ...rows.map(csvRow)].join("\n");
}

test("parses commas, quotes, and newlines inside quoted fields", () => {
  const rows = parseCsv('"Title","Value"\r\n"One, two","A ""quote""\nand newline"');
  assert.deepEqual(rows, [
    ["Title", "Value"],
    ["One, two", 'A "quote"\nand newline'],
  ]);
});

test("imports new rows, creates categories, and preserves Saved At", () => {
  const savedAt = "2026-09-20T10:30:00.000Z";
  const input = csvFile([
    [
      1,
      "A title, with punctuation",
      "abcdefghijk",
      "https://www.youtube.com/watch?v=abcdefghijk",
      75.5,
      "1:15",
      300,
      "5:00",
      "Research",
      savedAt,
    ],
  ]);

  const result = prepareCsvImport(input, [], ["Default"], "2026-09-25T00:00:00.000Z");

  assert.equal(result.imported, 1);
  assert.equal(result.overwritten, 0);
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.categories, ["Default", "Research"]);
  assert.equal(result.timestamps[0].savedAt, savedAt);
  assert.equal(result.timestamps[0].category, "Research");
});

test("overwrites matching videos while retaining their internal IDs", () => {
  const input = csvFile([
    [
      1,
      "Imported title",
      "abcdefghijk",
      "https://www.youtube.com/watch?v=abcdefghijk",
      120,
      "2:00",
      400,
      "6:40",
      "Imported",
      "2026-09-24T09:00:00.000Z",
    ],
  ]);
  const existing = [{ videoId: "abcdefghijk", id: 123, title: "Old title" }];

  const result = prepareCsvImport(input, existing, ["Default"], "2026-09-25T00:00:00.000Z");

  assert.equal(result.imported, 0);
  assert.equal(result.overwritten, 1);
  assert.equal(result.timestamps.length, 1);
  assert.equal(result.timestamps[0].id, 123);
  assert.equal(result.timestamps[0].title, "Imported title");
  assert.equal(result.timestamps[0].currentTime, 120);
});

test("skips invalid rows and uses the import time for a missing Saved At", () => {
  const importedAt = "2026-09-25T12:00:00.000Z";
  const input = csvFile([
    [
      1,
      "No date",
      "abcdefghijk",
      "https://www.youtube.com/watch?v=abcdefghijk",
      30,
      "0:30",
      100,
      "1:40",
      "",
      "",
    ],
    [
      2,
      "Bad video ID",
      "bad",
      "https://www.youtube.com/watch?v=bad",
      10,
      "0:10",
      100,
      "1:40",
      "Default",
      importedAt,
    ],
  ]);

  const result = prepareCsvImport(input, [], [], importedAt);

  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.timestamps[0].savedAt, importedAt);
  assert.equal(result.timestamps[0].category, "Default");
});

test("rejects files that do not use the exported CSV headers", () => {
  assert.throws(
    () => prepareCsvImport('"Title","URL"\n"Example","https://youtube.com"', [], []),
    /does not match/,
  );
});
