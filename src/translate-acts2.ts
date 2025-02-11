export async function translateWithActs2(
  englishTexts: string[],
  languageCode: string,
  key: string
): Promise<string[]> {
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
      texts: englishTexts,
    }),
  });

  if (!createCollectionResponse.ok) {
    throw new Error(
      `Failed to create text collection: ${await createCollectionResponse.text()}`
    );
  }

  const collection = await createCollectionResponse.json();

  // Translate the collection
  const translateResponse = await fetch(
    `${root}/${collection.id}/translate?target_language=${languageCode}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        api_key: key,
      },
    }
  );

  const translateResult = await translateResponse.json();
  //console.log(`translateResponse: ${JSON.stringify(translateResult)}`);

  if (!translateResponse.ok) {
    throw new Error(`Failed to translate text collection: ${translateResult}`);
  }

  // Poll for translations until they're ready
  const maxAttempts = 30;
  let attempts = 0;
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds before attempt
    const textsResponse = await fetch(
      `${root}/${collection.id}/texts?include_translations=true&target_language=${languageCode}`,
      {
        headers: {
          api_key: key,
        },
      }
    );

    if (!textsResponse.ok) {
      throw new Error(
        `Failed to get translations: ${await textsResponse.text()}`
      );
    }

    const responseArray = await textsResponse.json();
    if (responseArray) {
      console.log(`Response: ${JSON.stringify(responseArray, null, 2)}`);

      // Check if all texts have translations with 'complete' status
      const allTranslated = responseArray.every((text: any) =>
        text.translations?.some((t: any) => t.translation_status === "complete")
      );

      if (allTranslated) {
        // Extract translations in the same order as input texts
        return responseArray.map((text: any) => {
          const translation = text.translations?.find(
            (t: any) => t.translation_status === "complete"
          );
          return translation?.text || "";
        });
      }
    }

    attempts++;
    continue;
  }

  throw new Error(
    "Translation timed out - translations did not complete within the expected time"
  );
}
