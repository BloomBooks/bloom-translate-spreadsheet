import { translateWithGoogleTranslate } from "./translate-google";
import { translateWithActs2 } from "./translate-acts2";

type TranslationModel = "google" | "acts2" | "piglatin";

export function parseModelFromLanguageCode(
  langCode: string
): TranslationModel | null {
  if (langCode.includes("-acts2")) return "acts2";
  if (langCode.includes("-google")) return "google";
  if (langCode.includes("-piglatin")) return "piglatin";
  return null;
}

export async function translateToLanguage(
  englishTexts: string[],
  targetCode: string
): Promise<string[]> {
  if (!targetCode) {
    throw new Error("Target language code is required");
  }

  const model = parseModelFromLanguageCode(targetCode);
  if (!model) {
    throw new Error(
      `No supported translation model found in language code: ${targetCode}`
    );
  }

  const languageCode = targetCode.split("-")[0];
  if (!languageCode) {
    throw new Error(`Invalid language code format: ${targetCode}`);
  }

  if (model === "google") {
    if (!process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_ACCOUNT_EMAIL) {
      throw new Error(
        "Translating with Google requires the environment variables: BLOOM_GOOGLE_TRANSLATION_SERVICE_ACCOUNT_EMAIL. After setting it (and also BLOOM_GOOGLE_SERVICE_PRIVATE_KEY), you may have to restart your terminal."
      );
    }
    if (!process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_PRIVATE_KEY) {
      throw new Error(
        "Translating with Google requires the environment variables: BLOOM_GOOGLE_TRANSLATION_SERVICE_PRIVATE_KEY. After setting it (and also BLOOM_GOOGLE_SERVICE_ACCOUNT_EMAIL), you may have to restart your terminal."
      );
    }

    return await translateWithGoogleTranslate(
      englishTexts,
      languageCode,
      process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_ACCOUNT_EMAIL,
      process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_PRIVATE_KEY.replace(
        /\\n/g,
        "\n"
      )
    );
  }
  if (model === "acts2") {
    if (!process.env.BLOOM_ACTS2_KEY) {
      throw new Error(
        "Translating with Acts2 requires the environment variable BLOOM_ACTS2_KEY. After setting it, you may have to restart your terminal."
      );
    }
    return await translateWithActs2(
      englishTexts,
      languageCode,
      process.env.BLOOM_ACTS2_KEY
    );
  }
  if (model === "piglatin") {
    return englishTexts.map((text) => {
      if (!text) return "";
      return text
        .split(" ")
        .map((word) => {
          // Extract leading/trailing punctuation
          const leadingMatch = word.match(/^[^a-zA-Z]*/);
          const trailingMatch = word.match(/[^a-zA-Z]*$/);
          const leading = leadingMatch ? leadingMatch[0] : "";
          const trailing = trailingMatch ? trailingMatch[0] : "";
          const letters = word.slice(
            leading.length,
            word.length - trailing.length
          );

          if (!letters) return word; // Return original if no letters

          // Transform the letters part only
          const transformed = `${letters.slice(1)}${letters[0]}ay`;
          return leading + transformed + trailing;
        })
        .join(" ");
    });
  } else {
    throw new Error(`Unknown translation model ${model}`);
  }
}
