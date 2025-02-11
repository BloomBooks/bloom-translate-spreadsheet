import { expect, test, describe } from "bun:test";
import { findAITargetColumns } from "../src/columns";
import type { SpreadsheetData } from "../src/spreadsheet";

describe("findTranslatableColumns", () => {
  const mockData: SpreadsheetData = {
    headers: [
      "[en]",
      "[fr-x-ai-google]",
      "[es-x-ai-acts2]",
      "[fr]",
      "[es-x-ai-unknown]",
    ],
    rows: [
      {
        "[en]": "English",
        "[fr-x-ai-google]": "French",
        "[es-x-ai-acts2]": "",
        "[fr]": "French",
        "[es-x-ai-unknown]": "",
      },
      {
        "[en]": "Hello",
        "[fr-x-ai-google]": "Bonjour",
        "[es-x-ai-acts2]": "",
        "[fr]": "Bonjour",
        "[es-x-ai-unknown]": "",
      },
      {
        "[en]": "World",
        "[fr-x-ai-google]": "",
        "[es-x-ai-acts2]": "",
        "[fr]": "Monde",
        "[es-x-ai-unknown]": "",
      },
    ],
  };

  test("identifies translatable columns", () => {
    const result = findAITargetColumns(mockData);
    expect(result).toHaveLength(2); // Only google and acts2 columns should be found
    expect(
      result.find((c) => c.columnName === "[fr-x-ai-google]")
    ).toBeTruthy();
    expect(result.find((c) => c.columnName === "[es-x-ai-acts2]")).toBeTruthy();
  });

  test("correctly identifies empty status", () => {
    const result = findAITargetColumns(mockData);
    const googleCol = result.find((c) => c.columnName === "[fr-x-ai-google]");
    const acts2Col = result.find((c) => c.columnName === "[es-x-ai-acts2]");

    expect(googleCol?.isEmpty).toBe(false); // Has some content
    expect(acts2Col?.isEmpty).toBe(true); // All cells empty except language name
  });

  test("ignores second row when determining emptiness", () => {
    const data: SpreadsheetData = {
      headers: ["[en]", "[fr-x-ai-google]"],
      rows: [
        { "[en]": "English", "[fr-x-ai-google]": "French" }, // Language name row
        { "[en]": "Hello", "[fr-x-ai-google]": "" },
        { "[en]": "World", "[fr-x-ai-google]": "" },
      ],
    };
    const result = findAITargetColumns(data);
    expect(result[0].isEmpty).toBe(true);
  });

  test("handles spreadsheet with no translatable columns", () => {
    const data: SpreadsheetData = {
      headers: ["[en]", "[fr]"],
      rows: [
        { "[en]": "English", "[fr]": "French" },
        { "[en]": "Hello", "[fr]": "Bonjour" },
      ],
    };
    const result = findAITargetColumns(data);
    expect(result).toHaveLength(0);
  });
});
