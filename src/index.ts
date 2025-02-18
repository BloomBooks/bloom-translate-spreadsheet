#!/usr/bin/env bun
import { Command } from "commander";
import { createRequire } from "module";
import { resolve, basename } from "node:path";
import * as fs from "node:fs";
import * as spreadsheet from "./spreadsheet";
import { findAITargetColumns, translateColumn } from "./columns";
import { log, setVerbose, verbose } from "./logging";

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
      "-t,--target <tag>",
      "BCP47 language code with model. If this is not provided, the program will look in the input spreadsheet for empty columns to translate."
    )
    .option(
      "-s,--source <tag>",
      "BCP47 language code for source column (default: en)"
    )
    .option(
      "-r,--retranslate",
      "If this is provided, then columns will be replaced if they already exist. Otherwise, the program will not re-translate."
    )
    .option(
      "-v,--verbose",
      "Enable verbose logging"
    )
    .version(version)
    .addHelpText(
      "after",
      `
Example:
  $ bloom-translate-spreadsheet foo.xlsx
  $ bloom-translate-spreadsheet foo.xlsx -t es-x-ai-google -o foo-with-spanish.xlsx
  $ bloom-translate-spreadsheet foo.xlsx --target fr-x-ai-google --retranslate
  $ bloom-translate-spreadsheet foo.xlsx --source fr --target es-x-ai-google`
    );

  program.parse();

  const options = program.opts();
  setVerbose(options.verbose ?? false);
  const targetLangAndModel = options.target?.trim();
  const sourceLang = options.source?.trim() ?? "en";
  const shouldRetranslate = options.retranslate ?? false;
  const inputSpreadsheetPath = resolve(program.args[0]);

  verbose(`Starting translation process with verbose logging enabled`);
  verbose(`Input path: ${inputSpreadsheetPath}`);
  verbose(`Source language: ${sourceLang}`);

  // Read the spreadsheet data
  const data = await spreadsheet.read(inputSpreadsheetPath);
  // print out all the header cells
  verbose(`Headers: ${data.headers.join(", ")}`);

  // Generate default output path in the same directory as the input file
  const inputBasename = basename(inputSpreadsheetPath);
  const inputDir = resolve(inputSpreadsheetPath, '..');
  const defaultOutputPath = resolve(
    inputDir,
    inputBasename.replace(
      /\.xlsx$/,
      targetLangAndModel ? `-${targetLangAndModel}.xlsx` : "-translated.xlsx"
    )
  );
  const outputPath = options.output
    ? resolve(options.output)
    : defaultOutputPath;

  // Check to see if the output file is writable before we go any further. Might as well remove it too so that
  // if something goes wrong and we don't notice the error, we don't distribute a file that doesn't have the
  // work done on it that we thought it did.
  try {
    // if it exists
    if (fs.existsSync(outputPath))
      fs.rmSync(outputPath);
  } catch (error) {
    console.error(`Output file ${outputPath} is not writable. Make sure it isn't open in another program.`);
    process.exit(1);
  }
  let didTranslateSomethingSuccesfully = false;

  // If target is provided, translate just that column
  if (targetLangAndModel) {
    const columnName = `[${targetLangAndModel}]`;
    verbose(`Target language and model specified: ${targetLangAndModel}`);

    // Find if the column exists and check if it's empty
    const columns = findAITargetColumns(data, sourceLang);
    const existingColumn = columns.find(col => col.columnName === columnName);

    // Only prevent translation if the column exists and has no missing translations
    if (!shouldRetranslate && existingColumn && !existingColumn.hasMissingTranslations) {
      log(
        `Column ${columnName} already exists in the spreadsheet and has no missing translations. Use --retranslate flag to overwrite.`
      );
      process.exit(1);
    }

    if (await translateColumn(data, columnName, targetLangAndModel, sourceLang))
      didTranslateSomethingSuccesfully = true;

  } else {
    // Find all translatable columns
    const columns = findAITargetColumns(data, sourceLang);

    if (columns.length === 0) {
      log("No translatable columns found in the spreadsheet.");
      process.exit(0);
    }

    // Report what we are going to do with each
    log("Found ai columns:");
    for (const col of columns) {
      log(
        `- ${col.columnName}: ${col.hasMissingTranslations ? "has empty cells" : "has has no missing translations"}${shouldRetranslate ? " (will retranslate)" : ""}`
      );
    }

    // Translate selected columns
    for (const col of columns.filter(
      (col) => col.hasMissingTranslations || shouldRetranslate
    )) {
      log(`Translating ${col.columnName}...`);
      if (await translateColumn(
        data,
        col.columnName,
        `${col.languageCode}-x-ai-${col.model}`,
        sourceLang
      ))
        didTranslateSomethingSuccesfully = true;
    }
  }

  if (!didTranslateSomethingSuccesfully) {
    log("No translations were made.");
    process.exit(0);
  }
  verbose(`Writing output to: ${outputPath}`);
  // Write the modified data back to a spreadsheet
  await spreadsheet.write(data, outputPath);
  log(`Translated spreadsheet saved to: ${outputPath}`);
}

main().catch(console.error);
