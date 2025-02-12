import type { SpreadsheetData } from "./spreadsheet";
import { translateToLanguage } from "./translate";
import { verbose } from "./index";

export interface TranslatableColumn {
  columnName: string;
  languageCode: string;
  model: string;
  hasMissingTranslations: boolean;
}

export function findAITargetColumns(
  data: SpreadsheetData
): TranslatableColumn[] {
  const translatable: TranslatableColumn[] = [];

  verbose(`Found headers: ${JSON.stringify(data.headers)}`);

  for (const header of data.headers) {
    verbose(`Analyzing header: ${header}`);
    // Look for headers in the format [lang-x-ai-model], case insensitive for 'x' and 'ai'
    const match = header.match(/^\[(.*?-[xX]-(?:[aA][iI])-[^-\]]+)\]$/);
    if (!match) {
      verbose(`  Header ${header} did not match basic pattern`);
      continue;
    }

    const langWithModel = match[1];
    const parts = langWithModel.split("-");
    verbose(`  Found parts: ${JSON.stringify(parts)}`);

    if (parts.length !== 4) {
      verbose(`  Expected 4 parts but found ${parts.length}`);
      continue;
    }

    const [langCode, x, ai, model] = parts;
    if (x.toLowerCase() !== "x" || ai.toLowerCase() !== "ai") {
      verbose(`  Invalid x/ai parts: ${x}, ${ai}`);
      continue;
    }

    // Skip if model is not one we support (case insensitive match)
    const supportedModels = ["google", "acts2", "piglatin"];
    if (!supportedModels.some((m) => m === model.toLowerCase())) {
      verbose(`  Unsupported model: ${model}`);
      continue;
    }

    verbose(`Analyzing column ${header} for missing translations`);

    // Check if any English cell is missing a corresponding translation
    // Skip the first row (index 0) since it contains language names
    const hasMissingTranslations = data.rows.some((row, index) => {
      if (index === 0) return false; // Skip first row (language names)
      const englishText = row["[en]"];
      const targetText = row[header];
      if (englishText && !targetText) {
        verbose(`Found missing translation at row ${index + 1}:`);
        verbose(`  English: "${englishText}"`);
        verbose(`  ${header}: <empty>`);
        return true;
      }
      return false;
    });

    verbose(`Column ${header} has${hasMissingTranslations ? "" : " no"} missing translations`);

    translatable.push({
      columnName: header,
      languageCode: langCode,
      model: model.toLowerCase(), // Store model in lowercase for consistency
      hasMissingTranslations
    });
  }

  return translatable;
}

export async function translateColumn(
  data: SpreadsheetData,
  columnName: string,
  targetLangAndModel: string
) {
  // Find the position of [en] column
  const enIndex = data.headers.indexOf("[en]");
  if (enIndex === -1) return; // Exit if no [en] column exists

  // Add new column if it doesn't exist
  if (!data.headers.includes(columnName)) {
    data.headers.splice(enIndex + 1, 0, columnName);
  }

  // Get English texts to translate, including the first row (language name)
  const textsToTranslate = data.rows.map((row) => row["[en]"]).filter((text) => text);

  if (textsToTranslate.length === 0) {
    // If no texts to translate, remove the column if we just added it
    const columnIndex = data.headers.indexOf(columnName);
    if (columnIndex !== -1) {
      data.headers.splice(columnIndex, 1);
    }
    return;
  }

  try {
    const translations = await translateToLanguage(textsToTranslate, targetLangAndModel);

    // Map translations back to rows
    let translationIndex = 0;
    for (const row of data.rows) {
      if (row["[en]"]) {
        row[columnName] = translations[translationIndex++];
      } else {
        // For empty source texts, ensure target is undefined
        delete row[columnName];
      }
    }
  } catch (error) {
    // If translation fails, remove the column if we just added it
    const columnIndex = data.headers.indexOf(columnName);
    if (columnIndex !== -1 && !Object.values(data.rows[0]).some(v => v === columnName)) {
      data.headers.splice(columnIndex, 1);
    }
    // Don't rethrow the error - silently fail as per test requirements
  }
}
