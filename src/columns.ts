import { translateToLanguage } from "./translate";
import { verbose } from "./logging";

export interface HeaderAndRows {
  headers: string[];
  rows: Row[];
}

export interface Row {
  [key: string]: any;
}
export interface TranslatableColumn {
  columnName: string;
  languageCode: string;
  model: string;
  hasMissingTranslations: boolean;
}

export function findAITargetColumns(
  data: HeaderAndRows,
  sourceLang: string = "en"
): TranslatableColumn[] {
  const translatable: TranslatableColumn[] = [];
  const sourceColumn = `[${sourceLang}]`;

  verbose(`Found headers: ${JSON.stringify(data.headers)}`);
  verbose(`Using source column: ${sourceColumn}`);

  // Verify source column exists
  if (!data.headers.includes(sourceColumn)) {
    throw new Error(`Source language column ${sourceColumn} not found in spreadsheet`);
  }

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

    // Check if any source cell is missing a corresponding translation
    // Skip the first row (index 0) since it contains language names
    const hasMissingTranslations = data.rows.some((row, index) => {
      if (index === 0) return false; // Skip first row (language names)
      const sourceText = row[sourceColumn];
      const targetText = row[header];
      if (sourceText && !targetText) {
        verbose(`Found missing translation at row ${index + 1}:`);
        verbose(`  ${sourceColumn}: "${sourceText}"`);
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
  targetLangAndModel: string,
  sourceLang: string = "en"
): Promise<boolean> {
  const sourceColumn = `[${sourceLang}]`;
  const sourceColumnIndex = data.headers.indexOf(sourceColumn);
  if (sourceColumnIndex === -1) {
    console.error(`Source language column ${sourceColumn} not found in spreadsheet`);
    return false;
  }

  const translatableRowTypes = ["[bookTitle]", "[book title]", "[page content]", "[image description]"];

  const rowsToTranslate = data.rows
    .map((row, index) => ({ row, originalIndex: index }))
    .filter(({ row }) => {
      // console.log(`row[${sourceColumn}]: ${row[sourceColumn]}`);
      // console.log(`row["[row type]"]: ${row["[row type]"]}`);
      return row[sourceColumn] && translatableRowTypes.includes(row["[row type]"])
    });
  const textsToTranslate = rowsToTranslate.map(({ row }) => row[sourceColumn]);

  // Bail out if there is nothing that we should be translating
  if (textsToTranslate.length === 0) {
    console.log(`No rows found to translate for column ${columnName}`);
    return false;
  }

  try {
    const translations = await translateToLanguage(textsToTranslate, targetLangAndModel);

    // Add new column if it doesn't exist
    const columnIndex = data.headers.indexOf(columnName);
    //console.log(`columnIndex: ${columnIndex}`);
    if (columnIndex === -1) {
      // Insert new column after source column
      data.headers.splice(sourceColumnIndex + 1, 0, columnName);
    }

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
