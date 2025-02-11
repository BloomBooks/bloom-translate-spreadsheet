import { expect, test, describe } from "bun:test";
import type { TranslatableColumn } from "../src/columns";

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
});
