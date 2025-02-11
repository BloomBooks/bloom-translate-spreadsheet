#!/usr/bin/env bun
import { Command } from "commander";
import { createRequire } from "module";
import { resolve, basename } from "node:path";
import { translateToLanguage } from "../translate";
import * as spreadsheet from "./spreadsheet";

const require = createRequire(import.meta.url);
const { version } = require("./package.json");

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
      "BCP47 language code with model. If this is not provided, the program will look in the input spreadsheet for things columns translate. If it is specified, then the program will either add or re-use a column with the give tag. Example: fr-x-ai-google would add or reuse a French column translated with Google Translate)",
      "fr-x-ai-google"
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

  // Generate default output path in the current directory
  const inputBasename = basename(inputPath);
  const defaultOutputPath = resolve(
    process.cwd(),
    inputBasename.replace(/\.xlsx$/, `-${targetLangAndModel}.xlsx`)
  );
  const outputPath = options.output
    ? resolve(options.output)
    : defaultOutputPath;

  // Read the spreadsheet data
  const data = await spreadsheet.read(inputPath);

  // The column name should be the full language code including the model
  const columnName = `[${targetLangAndModel}]`;

  // if shouldRetranslate is false and the column is already there, print something and quit
  if (!shouldRetranslate && data.headers.includes(columnName)) {
    console.error(
      `Column ${columnName} already exists in the spreadsheet. Use --retranslate flag to overwrite.`
    );
    process.exit(1);
  }

  // Find the position of [en] column and create new header array
  const enIndex = data.headers.indexOf("[en]");
  if (enIndex !== -1 && !data.headers.includes(columnName)) {
    data.headers.splice(enIndex + 1, 0, columnName);
  }

  // Create translations for texts
  const textsToTranslate = data.rows
    .map((row) => row["[en]"])
    .filter((text) => text);

  const translations = await translateToLanguage(
    textsToTranslate,
    targetLangAndModel
  );

  // Map the translations back to the rows
  let translationIndex = 0;
  for (const row of data.rows) {
    if (row["[en]"]) {
      row[columnName] = translations[translationIndex++];
    }
  }

  // Write the modified data back to a spreadsheet
  await spreadsheet.write(data, outputPath);
  console.log(`Translated spreadsheet saved to: ${outputPath}`);
}

main().catch(console.error);
