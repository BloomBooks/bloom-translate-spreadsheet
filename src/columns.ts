import { translateToLanguage } from "./translate";
import { verbose } from "./logging";


export interface HeaderAndRows {
  headers: string[];
  rows: Row[];
}

export interface Row {
  "[en]": string;
  [key: string]: any;
}
export interface TranslatableColumn {
  columnName: string;
  languageCode: string;
  model: string;
  hasMissingTranslations: boolean;
}

export function findAITargetColumns(
  data: HeaderAndRows
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
  data: HeaderAndRows,
  columnName: string,
  targetLangAndModel: string
): Promise<boolean> {
  // Find the position of [en] column
  const enIndex = data.headers.indexOf("[en]");
  if (enIndex === -1) return false; // Exit if no [en] column exists

  // List of allowed row types to translate
  const allowedRowTypes = ["[bookTitle]", "[book title]", "[page content]", "[page description]"];

  // Determine if we have any valid rows to translate
  const hasValidRows = data.rows.some(row => {
    if (!row["[en]"]) return false;
    const typeColumn = row["type"];
    return !typeColumn || allowedRowTypes.includes(typeColumn);
  });

  if (!hasValidRows) {
    return false;
  }

  // Get English texts to translate
  const rowsToTranslate = data.rows
    .map((row, index) => ({ row, originalIndex: index }))
    .filter(({ row }) => {
      if (!row["[en]"]) return false;
      const typeColumn = row["type"];
      return !typeColumn || allowedRowTypes.includes(typeColumn);
    });

  const textsToTranslate = rowsToTranslate.map(({ row }) => row["[en]"]);

  try {
    const translations = await translateToLanguage(textsToTranslate, targetLangAndModel);

    // Add new column if it doesn't exist
    const columnIndex = data.headers.indexOf(columnName);
    if (columnIndex === -1) {
      // Insert new column after [en]
      data.headers.splice(enIndex + 1, 0, columnName);
    }

    // Initialize all cells to empty string for rows that have a type field
    data.rows.forEach(row => {
      if (row["type"] !== undefined) {
        row[columnName] = "";
      }
    });

    // Map translations back into the spreadsheet grid
    rowsToTranslate.forEach(({ row, originalIndex }, translationIndex) => {
      data.rows[originalIndex][columnName] = translations[translationIndex];
    });

    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to translate column ${columnName}: ${error.message}`);
    } else {
      console.error(`Failed to translate column ${columnName}: ${String(error)}`);
    }
    return false;
  }
}
