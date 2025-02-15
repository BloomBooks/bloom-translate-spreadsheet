import { log, verbose } from "./logging";

// Powerscript CURL to get models
// $headers = @{ 'accept' = 'application/json'; 'api_key' = $env:BLOOM_ACTS2_KEY }; Invoke-WebRequest -Uri 'https://acts2.multilingualai.com/api/v2/translation_models?src=eng&trg=wsg' -Headers $headers -Method GET

export async function translateWithActs2(
  sourceTexts: string[],
  languageCode: string,
  key: string
): Promise<string[]> {
  // If there are no texts to translate, return empty array immediately
  if (!sourceTexts || sourceTexts.length === 0) {
    return [];
  }

  console.log(`Acts2: Translating to language code ${languageCode}`);

  // Filter out empty strings to avoid API errors
  const textsToTranslate = sourceTexts.filter((text) => text.trim() !== "");

  // Act2 API only supports ISO 639-3 language codes
  // Convert a bunch (but not all) 2-letter language codes to ISO 639-3
  const langCodeMap: { [key: string]: string } = {
    es: "spa",
    fr: "fra",
    en: "eng",
    ar: "ara", // Arabic
    bn: "ben", // Bengali
    zh: "zho", // Chinese
    hi: "hin", // Hindi
    id: "ind", // Indonesian
    it: "ita", // Italian
    ja: "jpn", // Japanese
    ko: "kor", // Korean
    ms: "msa", // Malay
    pt: "por", // Portuguese
    ru: "rus", // Russian
    sw: "swa", // Swahili
    ta: "tam", // Tamil
    te: "tel", // Telugu
    th: "tha", // Thai
    tr: "tur", // Turkish
    ur: "urd", // Urdu
    vi: "vie", // Vietnamese
    de: "deu", // German
    nl: "nld", // Dutch
    fa: "fas", // Persian/Farsi
    pl: "pol", // Polish
    uk: "ukr", // Ukrainian
    ro: "ron", // Romanian
    el: "ell", // Greek
    cs: "ces", // Czech
    hu: "hun", // Hungarian
    fil: "fil", // Filipino/Tagalog
    my: "mya", // Burmese
    gu: "guj", // Gujarati
    mr: "mar", // Marathi
    pa: "pan", // Punjabi
    am: "amh", // Amharic
    ml: "mal", // Malayalam
    kn: "kan", // Kannada
    ha: "hau", // Hausa
    uz: "uzb", // Uzbek
    si: "sin", // Sinhala
    ka: "kat", // Georgian
    az: "aze", // Azerbaijani,
    bg: "bul", // Bulgarian
    sk: "slk", // Slovak
    hr: "hrv", // Croatian
    lt: "lit", // Lithuanian
    lv: "lav", // Latvian
    et: "est", // Estonian
    sr: "srp", // Serbian
    bs: "bos", // Bosnian
    mk: "mkd", // Macedonian
    sq: "sqi", // Albanian
    af: "afr", // Afrikaans
    eu: "eus", // Basque
    ca: "cat", // Catalan
    gl: "glg", // Galician
    hy: "hye", // Armenian
    is: "isl", // Icelandic
    km: "khm", // Khmer
    lo: "lao", // Lao
    mn: "mon", // Mongolian
    ne: "nep"  // Nepali
  };

  const acts2LangCode = langCodeMap[languageCode.toLowerCase()] || languageCode;
  verbose(`Acts2: Mapped language code ${languageCode} to ${acts2LangCode}`);

  const root = "https://acts2.multilingualai.com/api/v2/text_collections";

  // Create text collection first
  const createCollectionResponse = await fetch(root, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      api_key: key,
    },
    body: JSON.stringify({
      name: `Translation ${new Date().toISOString()}`,
      language: "eng", // currently ACTS to uses ISO 639-3 (3 letter codes)
      texts: textsToTranslate,
    }),
  });

  if (!createCollectionResponse.ok) {
    const errorText = await createCollectionResponse.text();
    console.error(`Acts2: Create collection failed with status ${createCollectionResponse.status}`);
    console.error(`Acts2: Error response: ${errorText}`);
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(
        `Failed to create text collection: ${errorJson.detail || errorText}`
      );
    } catch {
      throw new Error(`Failed to create text collection: ${errorText}`);
    }
  }

  const collection = await createCollectionResponse.json();
  verbose(`Acts2: Created collection with ID ${collection.id}`);

  // Translate the collection
  const translateResponse = await fetch(
    `${root}/${collection.id}/translate?target_language=${acts2LangCode}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: key,
      },
    }
  );

  if (!translateResponse.ok) {
    const errorText = await translateResponse.text();
    console.error(`Acts2: Translation request failed with status ${translateResponse.status}`);
    console.error(`Acts2: Error response: ${errorText}`);
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(
        `Failed to translate text collection: ${errorJson.detail || errorText}`
      );
    } catch {
      throw new Error(`Failed to translate text collection: ${errorText}`);
    }
  }

  const translateResult = await translateResponse.json();
  verbose(`Acts2: Translation request accepted`);

  // Poll for translations until they're ready
  const maxAttempts = 30; // TODO: Make this an option
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before attempt
    verbose(`Acts2: Checking translation status (attempt ${attempts + 1}/${maxAttempts})`);

    const textsResponse = await fetch(
      `${root}/${collection.id}/texts?include_translations=true&target_language=${acts2LangCode}`,
      {
        headers: {
          api_key: key,
        },
      }
    );

    if (!textsResponse.ok) {
      const errorText = await textsResponse.text();
      console.error(`Acts2: Status check failed with status ${textsResponse.status}`);
      console.error(`Acts2: Error response: ${errorText}`);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(
          `Failed to get translations: ${errorJson.detail || errorText}`
        );
      } catch {
        throw new Error(`Failed to get translations: ${errorText}`);
      }
    }

    const responseArray = await textsResponse.json();
    verbose(`Acts2: Got response with ${responseArray?.length || 0} items`);

    if (responseArray && Array.isArray(responseArray)) {
      const allComplete = responseArray.every((item) => {
        const translation = item?.translations?.find(
          (t: any) => t.language_id === acts2LangCode
        );
        return translation?.translation_status === "complete";
      });

      const completeCount = responseArray.filter((item) => {
        const translation = item?.translations?.find(
          (t: any) => t.language_id === acts2LangCode
        );
        return translation?.translation_status === "complete";
      }).length;

      console.log(`Acts2 ${acts2LangCode}: ${completeCount}/${textsToTranslate.length} complete after ${attempts + 1}/${maxAttempts} polls`);

      if (allComplete) {
        console.log(`Acts2: All translations complete for ${acts2LangCode}`);

        // Now collect all translations in order
        const result = new Array(sourceTexts.length).fill("");
        let translationIndex = 0;

        for (let i = 0; i < sourceTexts.length; i++) {
          if (sourceTexts[i].trim() !== "") {
            const translation = responseArray[translationIndex]?.translations?.find(
              (t: any) => t.language_id === acts2LangCode
            );
            result[i] = translation.text;
            log(`Acts2: [${i}] ✔️: "${sourceTexts[i].replaceAll("\n", "\\n").replaceAll("\r", "\\r")}" -> "${translation.text.replaceAll("\n", "\\n").replaceAll("\r", "\\r")}"`);
            translationIndex++;
          }
        }

        verbose(`Final translations: ${result}`);
        return result;
      }
    }

    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error(
        "Translation timed out - translations did not complete within the expected time"
      );
    }
  }

  throw new Error(
    "Translation timed out - translations did not complete within the expected time"
  );
}
