import { log, verbose } from "./logging";
import { convertToIso6393 } from "./language-codes";

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

  const acts2LangCode = convertToIso6393(languageCode);
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

  await translateResponse.json();
  verbose(`Acts2: Translation request accepted`);

  // Wait for translations to complete
  const responseArray = await waitForTranslations(collection.id, acts2LangCode, textsToTranslate, key, root);

  verbose(`Got translations: ${JSON.stringify(responseArray, null, 2)}`);

  // Build the result array with translations in the correct positions
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

async function waitForTranslations(
  collectionId: string,
  acts2LangCode: string,
  textsToTranslate: string[],
  key: string,
  root: string,
  maxAttempts = 30
): Promise<any[]> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    verbose(`Acts2: Checking translation status (attempt ${attempts + 1}/${maxAttempts})`);

    const textsResponse = await fetch(
      `${root}/${collectionId}/texts?include_translations=true&target_language=${acts2LangCode}`,
      {
        headers: { api_key: key },
      }
    );

    if (!textsResponse.ok) {
      const errorText = await textsResponse.text();
      console.error(`Acts2: Status check failed with status ${textsResponse.status}`);
      console.error(`Acts2: Error response: ${errorText}`);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(`Failed to get translations: ${errorJson.detail || errorText}`);
      } catch {
        throw new Error(`Failed to get translations: ${errorText}`);
      }
    }

    const responseArray = await textsResponse.json();
    verbose(`Acts2: Got response with ${responseArray?.length || 0} items`);

    if (responseArray && Array.isArray(responseArray)) {
      const completeCount = responseArray.filter((item) => {
        const translation = item?.translations?.find(
          (t: any) => t.language_id === acts2LangCode
        );
        return translation?.translation_status === "complete";
      }).length;

      console.log(`Acts2 ${acts2LangCode}: ${completeCount}/${textsToTranslate.length} complete after ${attempts + 1}/${maxAttempts} polls`);

      if (completeCount === textsToTranslate.length) {
        console.log(`Acts2: All translations complete for ${acts2LangCode}`);
        // Reorder the response array to match the original text order
        const orderedResponse = textsToTranslate.map(originalText => {
          return responseArray.find(item => item.text === originalText);
        });
        return orderedResponse;
      }
    }

    attempts++;
    if (attempts >= maxAttempts) {
      throw new Error("Translation timed out - translations did not complete within the expected time");
    }
  }

  throw new Error("Translation timed out - translations did not complete within the expected time");
}
