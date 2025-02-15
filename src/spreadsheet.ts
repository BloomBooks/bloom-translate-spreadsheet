import * as XLSX from "xlsx";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import type { HeaderAndRows, Row } from "./columns";

export async function read(
  path: string,
  sheetName: string = "BloomBook"
): Promise<HeaderAndRows> {
  if (!existsSync(path)) {
    throw new Error(`Input file not found: ${path}`);
  }

  const workbook = XLSX.readFile(path);

  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(
      `Sheet "${sheetName}" not found in workbook. Available sheets: ${workbook.SheetNames.join(", ")}`
    );
  }

  const sheet = workbook.Sheets[sheetName];

  // Get the range of the sheet
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");

  // Get headers from the first row
  const headers: string[] = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const cell = sheet[cellAddress];
    headers.push(cell ? String(cell.v) : "");
  }

  // Remove any empty headers from the end (but keep empty ones in the middle)
  while (headers.length > 0 && headers[headers.length - 1] === "") {
    headers.pop();
  }

  // Now get the data rows
  const rows = XLSX.utils.sheet_to_json<Row>(sheet, {
    header: headers,
    defval: "" // Use empty string as default value for missing cells
  });

  return { headers, rows };
}

export async function write(
  data: HeaderAndRows,
  outputPath: string,
  sheetName: string = "BloomBook"
): Promise<void> {
  try {
    // Delete existing file if it exists
    if (existsSync(outputPath)) {
      await unlink(outputPath);
    }

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(data.rows.slice(1), // remove the first row, which is a duplicate of headers except missing any changes we made to the headers
      {
        header: data.headers
      }
    );

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
