import * as XLSX from "xlsx";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";

export interface Row {
  "[en]": string;
  [key: string]: any;
}

export interface SpreadsheetData {
  headers: string[];
  rows: Row[];
}

export async function read(
  inputPath: string,
  sheetName: string = "BloomBook"
): Promise<SpreadsheetData> {
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const workbook = XLSX.readFile(inputPath);

  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(
      `Sheet "${sheetName}" not found in workbook. Available sheets: ${workbook.SheetNames.join(", ")}`
    );
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Row>(sheet);
  const headers = Object.keys(rows[0] || {});

  return { headers, rows };
}

export async function write(
  data: SpreadsheetData,
  outputPath: string,
  sheetName: string = "BloomBook"
): Promise<void> {
  try {
    // Delete existing file if it exists
    if (existsSync(outputPath)) {
      await unlink(outputPath);
    }

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data.rows, {
      header: data.headers,
    });

    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
    XLSX.writeFile(workbook, outputPath);
  } catch (error: any) {
    if (error.code === "EBUSY" || error.errno === -16) {
      throw new Error(
        `Cannot write to ${outputPath} because it is being used by another program (probably Excel). Please close the file and try again.`
      );
    }
    throw error; // Re-throw other errors
  }
}
