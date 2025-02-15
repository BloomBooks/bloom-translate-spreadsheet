import { expect, test, describe } from "bun:test";
import {
  findAITargetColumns,
  translateColumn,
  type HeaderAndRows,
  type TranslatableColumn,
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

  // Edge case: Empty spreadsheet
  test("should handle empty spreadsheet", () => {
    const data: HeaderAndRows = {
      headers: [],
      rows: [],
    };
    const result = findAITargetColumns(data);
    expect(result).toEqual([]);
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
  // Normal case: Translate to empty column
  test("should add new column and translate content", async () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr-x-ai-google]"],
      rows: [
        { "[en]": "English", "[fr-x-ai-piglatin]": "AI pig" },
        { "[en]": "One", "[fr-x-ai-piglatin]": "" },
        { "[en]": "Two", "[fr-x-ai-piglatin]": "" },
      ],
    };

    await translateColumn(data, "[es-x-ai-piglatin]", "es-x-ai-piglatin");

    console.log("*****data 123: " + JSON.stringify(data, null, 2));

    // Verify column was added after [en]
    expect(data.headers).toEqual([
      "[en]",
      "[es-x-ai-piglatin]",
      "[fr-x-ai-google]",
    ]);

    // Verify translations were added (using piglatin translation rules)
    expect(data.rows[1]["[es-x-ai-piglatin]"]).toBe("what");
    expect(data.rows[2]["[es-x-ai-piglatin]"]).toBe("owTay");
  });

  // Edge case: Empty source text
  test("should handle empty source texts", async () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr-x-ai-google]"],
      rows: [
        { "[en]": "English", "[fr-x-ai-google]": "French" },
        { "[en]": "", "[fr-x-ai-google]": "" },
        { "[en]": "", "[fr-x-ai-google]": "" },
      ],
    };

    await translateColumn(data, "[es-x-ai-piglatin]", "es-x-ai-piglatin");

    // Verify translations
    expect(data.rows[0]["[es-x-ai-piglatin]"]).toBe("nglishEay");
    // Verify empty rows remain empty
    expect(data.rows[1]["[es-x-ai-piglatin]"]).toBeUndefined();
    expect(data.rows[2]["[es-x-ai-piglatin]"]).toBeUndefined();
  });

  // Edge case: Column already exists
  test("should update existing column", async () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr-x-ai-piglatin]"],
      rows: [
        { "[en]": "English", "[fr-x-ai-piglatin]": "French" },
        { "[en]": "Hello", "[fr-x-ai-piglatin]": "Bonjour" },
      ],
    };

    await translateColumn(data, "[fr-x-ai-piglatin]", "fr-x-ai-piglatin");

    // Verify headers weren't duplicated
    expect(data.headers).toHaveLength(2);
    expect(data.headers).toContain("[fr-x-ai-piglatin]");
    // Verify translations were updated

    expect(data.rows[1]["[fr-x-ai-piglatin]"]).toBe("elloHay");
  });

  // Edge case: No [en] column
  test("should handle missing [en] source column", async () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr-x-ai-piglatin]"],
      rows: [
        { "[en]": "", "[fr-x-ai-piglatin]": "French" },
        { "[en]": "", "[fr-x-ai-piglatin]": "" },
      ],
    };

    await translateColumn(data, "[es-x-ai-piglatin]", "es-x-ai-piglatin");

    // Should not add new column since source texts are empty
    expect(data.headers).toEqual(["[en]", "[fr-x-ai-piglatin]"]);
    expect(data.rows[0]["[es-x-ai-piglatin]"]).toBeUndefined();
  });

  // Edge case: Mixed content (empty and non-empty cells)
  test("should handle mixed content in source column", async () => {
    const data: HeaderAndRows = {
      headers: ["[en]", "[fr-x-ai-piglatin]"],
      rows: [
        { "[en]": "English", "[fr-x-ai-piglatin]": "French" },
        { "[en]": "Hello", "[fr-x-ai-piglatin]": "" },
        { "[en]": "", "[fr-x-ai-piglatin]": "" },
        { "[en]": "World", "[fr-x-ai-piglatin]": "" },
        { "[en]": "", "[fr-x-ai-piglatin]": "" },
      ],
    };

    await translateColumn(data, "[es-x-ai-piglatin]", "es-x-ai-piglatin");
    console.log("*****data: " + JSON.stringify(data, null, 2));
    // Verify translations for non-empty cells

    expect(data.rows[1]["[es-x-ai-piglatin]"]).toBe("elloHay");
    expect(data.rows[2]["[es-x-ai-piglatin]"]).toBeUndefined();
    expect(data.rows[3]["[es-x-ai-piglatin]"]).toBe("orldWay");
    expect(data.rows[4]["[es-x-ai-piglatin]"]).toBeUndefined();
  });

  // Error handling: Invalid target language format
  test("should handle invalid target language format", async () => {
    const data: HeaderAndRows = {
      headers: ["[en]"],
      rows: [{ "[en]": "English" }, { "[en]": "Hello" }],
    };

    await translateColumn(data, "invalid-format", "invalid-format");

    // Should not modify the data structure
    expect(data.headers).toEqual(["[en]"]);
    expect(Object.keys(data.rows[0])).toEqual(["[en]"]);
  });
});
