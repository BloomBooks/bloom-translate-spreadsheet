import { expect, test, describe } from "bun:test";
import type { TranslatableColumn } from "../src/columns";
import { selectColumnsToTranslate } from "../src/columns";

describe("selectColumnsToTranslate", () => {
  const columns: TranslatableColumn[] = [
    {
      columnName: "[fr-x-ai-google]",
      languageCode: "fr",
      model: "google",
      isEmpty: true,
    },
    {
      columnName: "[es-x-ai-acts2]",
      languageCode: "es",
      model: "acts2",
      isEmpty: false,
    },
    {
      columnName: "[de-x-ai-google]",
      languageCode: "de",
      model: "google",
      isEmpty: false,
    },
  ];

  test("selects only empty columns when retranslate is false", () => {
    const result = selectColumnsToTranslate(columns, false);
    expect(result).toHaveLength(1);
    expect(result[0].columnName).toBe("[fr-x-ai-google]");
  });

  test("selects all columns when retranslate is true", () => {
    const result = selectColumnsToTranslate(columns, true);
    expect(result).toHaveLength(3);
    expect(result.map((c: TranslatableColumn) => c.columnName)).toEqual([
      "[fr-x-ai-google]",
      "[es-x-ai-acts2]",
      "[de-x-ai-google]",
    ]);
  });

  test("handles empty input", () => {
    const result = selectColumnsToTranslate([], false);
    expect(result).toHaveLength(0);
  });

  test("handles single target column", () => {
    const result = selectColumnsToTranslate([columns[0]], true);
    expect(result).toHaveLength(1);
    expect(result[0].columnName).toBe("[fr-x-ai-google]");
  });
});
