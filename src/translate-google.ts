import { v2 } from '@google-cloud/translate';

// targetLang: language code that normally ends in a private use subtag of
// the form "-x-ai-model" where "model" tells us which translation model to use/was used.
export async function translateWithGoogleTranslate(
    englishTexts: string[],
    targetLang: string,
    serviceAccountEmail: string,
    serviceAccountPrivateKey: string
): Promise<string[]> {
    const translate = new v2.Translate({
        credentials: {
            client_email: serviceAccountEmail,
            private_key: serviceAccountPrivateKey
        }
    });
    try {
        const [translations] = await translate.translate(englishTexts, targetLang);
        return Array.isArray(translations)
            ? translations
            : [translations];
    } catch (error) {
        console.error('Translation error:', error);
        throw error;
    }
}