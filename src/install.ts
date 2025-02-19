import { log, verbose } from "./logging";
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runRegCommand(command: string): Promise<string> {
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stderr) verbose(`Registry command stderr: ${stderr}`);
        return stdout;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Registry command failed: ${error.message}`);
        }
        throw error;
    }
}

export async function install() {
    if (process.platform !== 'win32') return;

    try {
        const exePath = process.execPath;
        verbose(`Checking Windows registry with exePath: ${exePath}`);

        // Try both HKLM and HKCU
        const hives = ['HKLM', 'HKCU'];
        let registrationSuccessful = false;

        for (const hive of hives) {
            if (registrationSuccessful) break;

            verbose(`Attempting registration with hive: ${hive}`);

            try {
                // // Check if the program is already registered
                // const checkCommand = `reg query "${hive}\\Software\\Classes\\BloomTranslateSpreadsheet\\shell\\open\\command" /ve`;
                // try {
                //     const result = await runRegCommand(checkCommand);
                //     if (result.includes(exePath)) {
                //         registrationSuccessful = true;
                //         verbose(`Program is already registered in Windows 'Open With' menu using ${hive}`);
                //         continue;
                //     }
                // } catch (error) {
                //     verbose(`Program not registered in ${hive}, proceeding with registration`);
                // }

                // Create necessary registry entries with --ui flag for Open With
                const registryCommands = [
                    `reg add "${hive}\\Software\\Classes\\BloomTranslateSpreadsheet" /ve /d "Bloom Translate Spreadsheet" /f`,
                    `reg add "${hive}\\Software\\Classes\\BloomTranslateSpreadsheet\\shell\\open\\command" /ve /d "\\"${exePath}\\" \\"%1\\" --ui" /f`,
                    `reg add "${hive}\\Software\\Classes\\.xlsx\\OpenWithProgids" /v "BloomTranslateSpreadsheet" /d "" /f`
                ];

                for (const command of registryCommands) {
                    verbose(`Executing registry command: ${command}`);
                    await runRegCommand(command);
                }

                registrationSuccessful = true;
                log(`Successfully added program to Windows 'Open With' menu`);
            } catch (err) {
                if (err instanceof Error) {
                    verbose(`Registry operation failed in ${hive}: ${err.message}`);
                    verbose(`Error stack trace: ${err.stack}`);
                }
                // Continue to try next hive if available
                continue;
            }
        }

        if (!registrationSuccessful) {
            log("Failed to register program in Windows 'Open With' menu. Try running with administrator privileges.");
        }
    } catch (error) {
        verbose(`Registry operation failed: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && error.stack) {
            verbose(`Error stack trace: ${error.stack}`);
        }
    }
}