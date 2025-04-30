import * as deepl from 'deepl-node';

export async function translateWithDeepL(
    englishTexts: string[],
    languageCode: string,
    key: string,
): Promise<string[]> {
    const translator = new deepl.Translator(key);
    try {
        const translations = await Promise.all(
            englishTexts.map(async (text) => {
                return await translator.translateText(text, null, languageCode as deepl.TargetLanguageCode)
            })
        );
        return translations.map((translation) => translation.text);
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}
