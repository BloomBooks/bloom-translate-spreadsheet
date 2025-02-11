import type { SpreadsheetData } from "./spreadsheet";
import { translateToLanguage } from "./translate";

export interface TranslatableColumn {
  columnName: string;
  languageCode: string;
  model: string;
  isEmpty: boolean;
}

export function findAITargetColumns(
  data: SpreadsheetData
): TranslatableColumn[] {
  const translatable: TranslatableColumn[] = [];

  for (const header of data.headers) {
    // Look for headers in the format [lang-x-ai-model]
    const match = header.match(/\[(.*?-x-ai-.*?)\]/);
    if (!match) continue;

    const langWithModel = match[1];
    const [langCode, _, __, model] = langWithModel.split("-");

    // Skip if model is not one we support
    if (!["google", "acts2", "piglatin"].includes(model)) continue;

    // Check if column is empty (ignoring first row which contains language names)
    const isEmpty = data.rows.slice(1).every((row) => !row[header]);

    translatable.push({
      columnName: header,
      languageCode: langCode,
      model,
      isEmpty,
    });
  }

  return translatable;
}

export async function translateColumn(
  data: SpreadsheetData,
  columnName: string,
  targetLangAndModel: string
) {
  // Find the position of [en] column and create new header array if needed
  const enIndex = data.headers.indexOf("[en]");
  if (enIndex !== -1 && !data.headers.includes(columnName)) {
    data.headers.splice(enIndex + 1, 0, columnName);
  }

  // Create translations for texts, skipping the first row (language name)
  const textsToTranslate = data.rows
    .slice(1)
    .map((row) => row["[en]"])
    .filter((text) => text);

  const translations = await translateToLanguage(
    textsToTranslate,
    targetLangAndModel
  );

  // Map the translations back to the rows, skipping the first row
  let translationIndex = 0;
  for (let i = 1; i < data.rows.length; i++) {
    const row = data.rows[i];
    if (row["[en]"]) {
      row[columnName] = translations[translationIndex++];
    }
  }
}
