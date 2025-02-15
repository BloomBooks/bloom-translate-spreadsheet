import { expect, test, describe } from "bun:test";
import {
  findAITargetColumns,
  translateColumn,
  type HeaderAndRows,
  type TranslatableColumn,
  type Row
} from "./columns";

describe("findAITargetColumns", () => {
  // Normal case: Various supported AI model columns
  test("should identify supported AI model columns", () => {
    const data: HeaderAndRows = {
      headers: [
        "[en]",
        "[fr-x-ai-google]",
        "[es-x-ai-acts2]",
        "[de-x-ai-google]",
      ],
      rows: [
        {
          "[en]": "English",
          "[fr-x-ai-google]": "",
          "[es-x-ai-acts2]": "Spanish",
          "[de-x-ai-google]": "German",
        },
        {
          "[en]": "Hello",
          "[fr-x-ai-google]": "",
          "[es-x-ai-acts2]": "Hola",
          "[de-x-ai-google]": "Hallo",
        },
      ],
    };

    const result = findAITargetColumns(data);
    expect(result).toEqual([
      {
        columnName: "[fr-x-ai-google]",
        languageCode: "fr",
        model: "google",
        hasMissingTranslations: true,
      },
      {
        columnName: "[es-x-ai-acts2]",
        languageCode: "es",
        model: "acts2",
        hasMissingTranslations: false,
      },
      {
        columnName: "[de-x-ai-google]",
        languageCode: "de",
        model: "google",
        hasMissingTranslations: false,
      },
    ]);
  });

  // Edge case: No AI columns
  test("should handle spreadsheet with no AI columns", () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr]", "[es]", "Notes"],
      rows: [
        { "[en]": "English", "[fr]": "French", "[es]": "Spanish", Notes: "" },
      ],
    };
    const result = findAITargetColumns(data);
    expect(result).toEqual([]);
  });

  // Input validation: Unsupported model
  test("should ignore unsupported AI models", () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr-x-ai-unknown]", "[es-x-ai-acts2]"],
      rows: [
        {
          "[en]": "English",
          "[fr-x-ai-unknown]": "",
          "[es-x-ai-acts2]": "Spanish",
        },
      ],
    };
    const result = findAITargetColumns(data);
    expect(result).toHaveLength(1);
    expect(result[0].model).toBe("acts2");
  });

  // Edge case: Malformed column headers
  test("should handle malformed column headers", () => {
    const data: HeaderAndRows = {
      headers: [
        "[en]",
        "[fr]-x-ai-google",
        "es-x-ai-acts2",
        "[es-x-ai-acts2-extra]",
      ],
      rows: [
        {
          "[en]": "English",
          "[fr]-x-ai-google": "",
          "es-x-ai-acts2": "",
          "[es-x-ai-acts2-extra]": "",
        },
      ],
    };
    const result = findAITargetColumns(data);
    expect(result).toHaveLength(0); // Headers must be properly bracketed with correct format
  });

  // Edge case: Multiple supported models for same language
  test("should handle multiple AI models for same language", () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr-x-ai-google]", "[fr-x-ai-acts2]"],
      rows: [
        { "[en]": "English", "[fr-x-ai-google]": "", "[fr-x-ai-acts2]": "" },
        { "[en]": "Test", "[fr-x-ai-google]": "", "[fr-x-ai-acts2]": "" },
      ],
    };
    const result = findAITargetColumns(data);
    expect(result).toHaveLength(2);
    expect(result[0].languageCode).toBe("fr");
    expect(result[1].languageCode).toBe("fr");
    expect(result[0].model).not.toBe(result[1].model);
  });

  // Input validation: Case sensitivity
  test("should handle case insensitivity in x-ai and model names", () => {
    const data: HeaderAndRows = {
      headers: [
        "[en]",
        "[fr-x-ai-GOOGLE]", // uppercase model
        "[es-X-AI-acts2]", // uppercase X and AI
        "[de-X-ai-ACTS2]", // mixed case
        "[it-x-AI-Google]", // mixed case
      ],
      rows: [
        {
          "[en]": "English",
          "[fr-x-ai-GOOGLE]": "",
          "[es-X-AI-acts2]": "",
          "[de-X-ai-ACTS2]": "",
          "[it-x-AI-Google]": "",
        },
      ],
    };
    const result = findAITargetColumns(data);
    expect(result).toHaveLength(4);
    // Verify all models are normalized to lowercase
    expect(result.every((col) => col.model === col.model.toLowerCase())).toBe(
      true
    );
    // Verify all variations were matched
    expect(result.map((col) => col.languageCode).sort()).toEqual(
      ["de", "es", "fr", "it"].sort()
    );
  });

  test("should correctly identify columns needing translation", () => {
    const data: HeaderAndRows = {
      headers: [
        "[en]",
        "[fr-x-ai-google]",  // Partially translated
        "[es-x-ai-acts2]",   // Fully translated
        "[de-x-ai-google]",  // Missing some translations
      ],
      rows: [
        {
          "[en]": "English",
          "[fr-x-ai-google]": "Français",
          "[es-x-ai-acts2]": "Español",
          "[de-x-ai-google]": "Deutsch",
        },
        {
          "[en]": "Hello",
          "[fr-x-ai-google]": "Bonjour",
          "[es-x-ai-acts2]": "Hola",
          "[de-x-ai-google]": "",  // Missing translation
        },
        {
          "[en]": "World",
          "[fr-x-ai-google]": "",  // Missing translation
          "[es-x-ai-acts2]": "Mundo",
          "[de-x-ai-google]": "Welt",
        },
      ],
    };

    const result = findAITargetColumns(data);

    // Both fr and de columns should be marked as having missing translations
    // because they have at least one missing translation
    expect(result).toEqual([
      {
        columnName: "[fr-x-ai-google]",
        languageCode: "fr",
        model: "google",
        hasMissingTranslations: true,
      },
      {
        columnName: "[es-x-ai-acts2]",
        languageCode: "es",
        model: "acts2",
        hasMissingTranslations: false,
      },
      {
        columnName: "[de-x-ai-google]",
        languageCode: "de",
        model: "google",
        hasMissingTranslations: true,
      },
    ]);
  });

  test("should ignore first row (language names) when determining if translation is needed", () => {
    const data: HeaderAndRows = {
      headers: [
        "[en]",
        "[fr-x-ai-google]",  // Empty language name, filled translations
        "[es-x-ai-acts2]",   // Filled language name, filled translations
        "[de-x-ai-google]",  // Filled language name, missing translations
      ],
      rows: [
        {
          // First row (language names)
          "[en]": "English",
          "[fr-x-ai-google]": "",  // Empty language name shouldn't affect hasMissingTranslations
          "[es-x-ai-acts2]": "Spanish",
          "[de-x-ai-google]": "German",
        },
        {
          // Content rows
          "[en]": "Hello",
          "[fr-x-ai-google]": "Bonjour",
          "[es-x-ai-acts2]": "Hola",
          "[de-x-ai-google]": "",  // Missing translation
        },
        {
          "[en]": "World",
          "[fr-x-ai-google]": "Monde",
          "[es-x-ai-acts2]": "Mundo",
          "[de-x-ai-google]": "",  // Missing translation
        },
      ],
    };

    const result = findAITargetColumns(data);

    expect(result).toEqual([
      {
        columnName: "[fr-x-ai-google]",
        languageCode: "fr",
        model: "google",
        hasMissingTranslations: false,  // Should be false because all content rows are translated
      },
      {
        columnName: "[es-x-ai-acts2]",
        languageCode: "es",
        model: "acts2",
        hasMissingTranslations: false,
      },
      {
        columnName: "[de-x-ai-google]",
        languageCode: "de",
        model: "google",
        hasMissingTranslations: true,   // Should be true because content rows are missing translations
      },
    ]);
  });
});

describe("translateColumn", () => {
  test("should translate from custom source language", async () => {
    const csv = `[row type],[fr],[en],[piglatin-x-ai-piglatin]
Row type,Français,English
[page content],Bonjour,Hello`;
    const data = parseCsvIntoHeadersAndRows(csv);

    await translateColumn(data, "[piglatin-x-ai-piglatin]", "piglatin-x-ai-piglatin", "fr");

    expect(data.headers).toEqual(["[row type]", "[fr]", "[en]", "[piglatin-x-ai-piglatin]"]);
    expect(data.rows[1]["[piglatin-x-ai-piglatin]"]).toBe("onjourBay");
  });

  test("should insert column if needed", async () => {

    const csv = `[row type],[en],[fr]
  Row type,English,French
  [page content],Two`;
    const data = parseCsvIntoHeadersAndRows(csv);

    await translateColumn(data, "[es-x-ai-piglatin]", "es-x-ai-piglatin");
    //console.log("*****data: " + JSON.stringify(data, null, 2));

    expect(data.headers).toEqual(["[row type]", "[en]", "[es-x-ai-piglatin]", "[fr]"]); // should insert this tag at the top
    // here row[0] is actually the 2nd row in the output spreadsheet because this data structure uses "headers" for the first row
    expect(data.rows[1]["[es-x-ai-piglatin]"]).toBe(/* two */ "woTay");
  });


  // Mixed content (empty and non-empty cells)
  test("should handle mixed content in source column", async () => {

    const csv = `[row type],[en]
Row type,English
[page content],Two
[page content]
[page content],Four
[topic],Animal Stories`;
    const data = parseCsvIntoHeadersAndRows(csv);

    await translateColumn(data, "[es-x-ai-piglatin]", "es-x-ai-piglatin");
    console.log("*****data: " + JSON.stringify(data, null, 2));

    expect(data.headers).toEqual(["[row type]", "[en]", "[es-x-ai-piglatin]"]); // should insert this tag at the top
    // here row[0] is actually the 2nd row in the output spreadsheet because this data structure uses "headers" for the first row
    expect(data.rows[0]["[es-x-ai-piglatin]"]).toBeUndefined(); // language name cell, which we don't know
    expect(data.rows[1]["[es-x-ai-piglatin]"]).toBe(/* two */ "woTay");
    expect(data.rows[2]["[es-x-ai-piglatin]"]).toBeUndefined(); // empty cell
    expect(data.rows[3]["[es-x-ai-piglatin]"]).toBe(/* four */ "ourFay");
    expect(data.rows[4]["[es-x-ai-piglatin]"]).toBeUndefined(); // [topic] is not in the list of translatable row types
  });

});
test("if header already has target, do not add another", async () => {
  const csv = `[row type],[en],[es-x-ai-piglatin]`;
  const data = parseCsvIntoHeadersAndRows(csv);
  await translateColumn(data, "[es-x-ai-piglatin]", "es-x-ai-piglatin");
  expect(data.headers).toEqual(["[row type]", "[en]", "[es-x-ai-piglatin]"]);
});

function parseCsvIntoHeadersAndRows(csv: string): HeaderAndRows {
  const lines = csv.trim().split('\n');
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Parse headers from first line
  const headers = lines[0].split(',').map(header => header.trim());

  // Skip first line (row type header) and parse data rows
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(value => value.trim());
    const row: Row = {
      "[en]": "" // Initialize with empty string to satisfy Row interface
    };

    // Build row object mapping headers to values
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    return row;
  });

  return { headers, rows };
}

