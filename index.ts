#!/usr/bin/env bun
import * as XLSX from 'xlsx';
import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { translateToLanguage } from './translate';
import { Command } from 'commander';
import { createRequire } from 'module';
import { resolve, basename, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

interface Row {
    "[en]": string;
    [key: string]: any;
}

async function main() {
    const program = new Command();

    program
        .name('bloom-translate-spreadsheet')
        .description('Translates Bloom spreadsheet content to different languages')
        .argument('<inputPath>', 'Input Excel file path')
        .option('-o, --output <path>', 'Output Excel file path (default: {input-filename}-{language}.xlsx)')
        .option('--target <tag>', 'BCP47 language code with model. If this is not provided, the program will look in the input spreadsheet for things columns translate. If it is specified, then the program will either add or re-use a column with the give tag. Example: fr-x-ai-gt would add or reuse a French column translated with Google Translate)', 'fr-x-ai-gt')
        .option('--retranslate', 'If this is provided, then columns will be replaced if they already exist. Otherwise, the program will not re-translate.')
        .version(version)
        .addHelpText('after', `
Example:
  $ bloom-translate-spreadsheet foo.xlsx
  $ bloom-translate-spreadsheet foo.xlsx --target es-x-ai-gt -o foo-with-spanish.xlsx
  $ bloom-translate-spreadsheet foo.xlsx --target fr-x-ai-gt --retranslate`);

    program.parse();

    const options = program.opts();
    const targetLangAndModel = options.target;
    const shouldRetranslate = options.retranslate;
    const inputPath = resolve(program.args[0]);
    const sheetName = "BloomBook";

    // The column name should be the full language code including the model
    const columnName = `[${targetLangAndModel}]`;

    // Generate default output path in the current directory
    const inputBasename = basename(inputPath);
    const defaultOutputPath = resolve(process.cwd(), inputBasename.replace(/\.xlsx$/, `-${targetLangAndModel}.xlsx`));
    const outputPath = options.output ? resolve(options.output) : defaultOutputPath;

    if (!existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    // Delete existing file if it exists
    if (existsSync(outputPath)) {
        await unlink(outputPath);
    }

    // Read the Excel file
    const workbook = XLSX.readFile(inputPath);

    // Verify the sheet exists
    if (!workbook.SheetNames.includes(sheetName)) {
        console.error(`Sheet "${sheetName}" not found in workbook. Available sheets: ${workbook.SheetNames.join(', ')}`);
        process.exit(1);
    }

    const sheet = workbook.Sheets[sheetName];

    // Convert the sheet to JSON
    const inputSheet = XLSX.utils.sheet_to_json<Row>(sheet);

    // Get current headers from the first row
    const headers = Object.keys(inputSheet[0] || {});

    // if shouldRetranslate is false and the column is already there, print something and quit
    if (!shouldRetranslate && headers.includes(columnName)) {
        console.error(`Column ${columnName} already exists in the spreadsheet. Use --retranslate flag to overwrite.`);
        process.exit(1);
    }

    // Find the position of [en] column and create new header array
    const enIndex = headers.indexOf('[en]');
    const newHeaders = [...headers];

    // If we don't yet have a column for the target language and model, insert it right after the [en] column.
    if (enIndex !== -1 && !headers.includes(columnName)) {
        newHeaders.splice(enIndex + 1, 0, columnName);
    }

    // Create translations for texts
    const textsToTranslate = inputSheet
        .map(row => row['[en]'])
        .filter(text => text); // Filter out any undefined or empty strings

    const translations = await translateToLanguage(textsToTranslate, targetLangAndModel);

    // Map the translations back to the rows
    let translationIndex = 0;
    for (const row of inputSheet) {
        if (row['[en]']) {
            row[columnName] = translations[translationIndex++];
        }
    }

    // Create a new workbook
    const newWorkbook = XLSX.utils.book_new();

    // Convert back to sheet with the correct column order
    const newSheet = XLSX.utils.json_to_sheet(inputSheet, {
        header: newHeaders
    });

    XLSX.utils.book_append_sheet(newWorkbook, newSheet, "BloomBook");

    // Write to file
    XLSX.writeFile(newWorkbook, outputPath);
    console.log(`Translated spreadsheet saved to: ${outputPath}`);
}

main().catch(console.error);