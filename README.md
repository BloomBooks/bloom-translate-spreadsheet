# bloom-translate-spreadsheet (bts.exe)

A command-line tool for translating Bloom spreadsheet content to different languages using various translation models.

- Currently supports these translation services:
  - Google Translate (`-x-ai-google`)
  - Pig Latin (`-x-ai-piglatin`)

## Installation

Download the executable from the [Releases](../../releases) page of this repository:

- Windows: `bts.exe`

For Google Translate functionality, set these environment variables:

- `BLOOM_GOOGLE_TRANSLATION_SERVICE_ACCOUNT_EMAIL`
- `BLOOM_GOOGLE_TRANSLATION_SERVICE_PRIVATE_KEY`
  You will need to restart your terminal before it will see any changes you make to environment variables.

## Usage

Basic usage:

```bash
# On Windows:
.\bts.exe <inputPath> [options]
```

Options:

- `-o, --output <path>` - Output Excel file path (default: {input-filename}-{language}.xlsx)
- `-t, --target <tag>` - BCP47 language code with model (default: fr-x-ai-google)
- `-r, --retranslate` - Replace existing columns if they already exist
- `-s, --source` - The source column to translate from (default: en)
- `-V, --version` - Output the version number
- `-h, --help` - Display help information

Examples:

```bash
# Find all the existing "[**-x-ai-**] columns and translate any that are empty
./bts foo.xlsx

# Fill a column (create it if it doesn't already exist) for a pretend piglatin service
./bts foo.xlsx --target es-x-ai-piglatin

# Fill a column (create it if it doesn't already exist) with Spanish using Google Translate. Ignore it if it isn't empty.
./bts foo.xlsx --target es-x-ai-google -o foo-with-spanish.xlsx

# Fill a column (create it if it doesn't already exist) with French using Google Translate. Overwrite whatever might be there.
./bts foo.xlsx --target fr-x-ai-google --retranslate
```

## Developing

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.1.36 or later)

To install Bun:

```bash
# For Windows (using PowerShell):
powershell -c "irm bun.sh/install.ps1|iex"

# For Linux and macOS:
curl -fsSL https://bun.sh/install | bash
```

After installation, restart your terminal and verify the installation:

```bash
bun --version
```

### Setup

```bash
# Clone the repository
git clone [repository-url]
cd bloom-translate-spreadsheet

# Install dependencies
bun install
```

### Running Tests

```bash
bun test
```

### Build stand-alone exe

```bash
bun build index.ts --outfile bts
```

### Github Actions and version numbers

The first two semantic versioning components are stored in the `version` in package.json. The Github Release Action adds a build number to that. See `.github\workflows\release.yml`

## License

MIT
Copyright SIL Global 2025
