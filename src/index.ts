#!/usr/bin/env bun
import { Command } from "commander";
import { createRequire } from "module";
import { resolve, basename } from "node:path";
import * as spreadsheet from "./spreadsheet";
import {
  findTranslatableColumns,
  selectColumnsToTranslate,
  translateColumn,
} from "./columns";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

async function main() {
  const program = new Command();

  program
    .name("bloom-translate-spreadsheet")
    .description("Translates Bloom spreadsheet content to different languages")
    .argument("<inputPath>", "Input Excel file path")
    .option(
      "-o, --output <path>",
      "Output Excel file path (default: {input-filename}-{language}.xlsx)"
    )
    .option(
      "--target <tag>",
      "BCP47 language code with model. If this is not provided, the program will look in the input spreadsheet for empty columns to translate."
    )
    .option(
      "--retranslate",
      "If this is provided, then columns will be replaced if they already exist. Otherwise, the program will not re-translate."
    )
    .version(version)
    .addHelpText(
      "after",
      `
Example:
  $ bloom-translate-spreadsheet foo.xlsx
  $ bloom-translate-spreadsheet foo.xlsx --target es-x-ai-google -o foo-with-spanish.xlsx
  $ bloom-translate-spreadsheet foo.xlsx --target fr-x-ai-google --retranslate`
    );

  program.parse();

  const options = program.opts();
  const targetLangAndModel = options.target;
  const shouldRetranslate = options.retranslate;
  const inputPath = resolve(program.args[0]);

  // Read the spreadsheet data
  const data = await spreadsheet.read(inputPath);

  // If target is provided, translate just that column
  if (targetLangAndModel) {
    const columnName = `[${targetLangAndModel}]`;

    // if shouldRetranslate is false and the column is already there, print something and quit
    if (!shouldRetranslate && data.headers.includes(columnName)) {
      console.error(
        `Column ${columnName} already exists in the spreadsheet. Use --retranslate flag to overwrite.`
      );
      process.exit(1);
    }

    await translateColumn(data, columnName, targetLangAndModel);
  } else {
    // Find all translatable columns and process them
    const columns = findTranslatableColumns(data);

    if (columns.length === 0) {
      console.log("No translatable columns found in the spreadsheet.");
      process.exit(0);
    }

    // Report what we found
    console.log("Found translatable columns:");
    for (const col of columns) {
      console.log(
        `- ${col.columnName}: ${col.isEmpty ? "empty" : "has content"}${shouldRetranslate ? " (will retranslate)" : ""}`
      );
    }

    // Get the columns we should translate based on their status and retranslate flag
    const columnsToTranslate = selectColumnsToTranslate(
      columns,
      shouldRetranslate
    );

    // Translate selected columns
    for (const col of columnsToTranslate) {
      console.log(`Translating ${col.columnName}...`);
      await translateColumn(
        data,
        col.columnName,
        `${col.languageCode}-x-ai-${col.model}`
      );
    }

    // Report skipped columns
    const skippedColumns = columns.filter(
      (col) => !columnsToTranslate.includes(col)
    );
    for (const col of skippedColumns) {
      console.log(
        `Skipping ${col.columnName} as it has content (use --retranslate to override)`
      );
    }
  }

  // Generate default output path in the current directory if not provided
  const inputBasename = basename(inputPath);
  const defaultOutputPath = resolve(
    process.cwd(),
    inputBasename.replace(
      /\.xlsx$/,
      targetLangAndModel ? `-${targetLangAndModel}.xlsx` : "-translated.xlsx"
    )
  );
  const outputPath = options.output
    ? resolve(options.output)
    : defaultOutputPath;

  // Write the modified data back to a spreadsheet
  await spreadsheet.write(data, outputPath);
  console.log(`Translated spreadsheet saved to: ${outputPath}`);
}

main().catch(console.error);
