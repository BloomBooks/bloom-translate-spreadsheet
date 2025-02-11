export async function translateWithActs2(
  englishTexts: string[],
  languageCode: string,
  key: string
): Promise<string[]> {
  // If there are no texts to translate, return empty array immediately
  if (!englishTexts || englishTexts.length === 0) {
    return [];
  }

  console.log(`Acts2: Translating to language code ${languageCode}`);

  // Filter out empty strings to avoid API errors
  const textsToTranslate = englishTexts.filter((text) => text.trim() !== "");
  if (textsToTranslate.length === 0) {
    // Return an array of empty strings matching the input length
    return englishTexts.map(() => "");
  }

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
  console.log(`Acts2: Mapped language code ${languageCode} to ${acts2LangCode}`);
  console.log(`Acts2: First text to translate: "${textsToTranslate[0]}"`);

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
  console.log(`Acts2: Created collection with ID ${collection.id}`);

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
  console.log(`Acts2: Translation request accepted`);

  // Poll for translations until they're ready
  const maxAttempts = 30;
  let attempts = 0;
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before attempt
    console.log(`Acts2: Checking translation status (attempt ${attempts + 1}/${maxAttempts})`);
    
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
    console.log(`Acts2: Got response with ${responseArray?.length || 0} items`);
    
    if (responseArray && Array.isArray(responseArray)) {
      // Map back to original array structure, preserving empty strings
      const translations = new Array(englishTexts.length).fill("");
      let translationIndex = 0;
      let allComplete = true;

      for (let i = 0; i < englishTexts.length; i++) {
        if (englishTexts[i].trim() !== "") {
          const translation = responseArray[
            translationIndex
          ]?.translations?.find(
            (t: any) => t.language_id === acts2LangCode
          );
          
          if (translation?.translation_status === "complete" && translation?.text) {
            translations[i] = translation.text;
            console.log(`Acts2: Translation ${i}: "${englishTexts[i]}" -> "${translation.text}"`);
          } else {
            console.log(`Acts2: Translation ${i} status: ${translation?.translation_status}, waiting...`);
            allComplete = false;
          }
          translationIndex++;
        }
      }

      // Only return if all translations are actually complete
      if (allComplete && translationIndex === textsToTranslate.length) {
        console.log(`Acts2: All translations complete. Final translations:`, translations);
        return translations;
      }
    }

    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error(
        "Translation timed out - translations did not complete within the expected time"
      );
    }
    continue;
  }

  throw new Error(
    "Translation timed out - translations did not complete within the expected time"
  );
}
