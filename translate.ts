import { v2 } from '@google-cloud/translate';
import { translateWithGoogleTranslate } from './src/googleTranslate';

type TranslationModel = 'gt' | 'acts2' | 'piglatin';

export function parseModelFromLanguageCode(langCode: string): TranslationModel | null {
    if (langCode.includes('-acts2')) return 'acts2';
    if (langCode.includes('-gt')) return 'gt';
    if (langCode.includes('-piglatin')) return 'piglatin';
    return null;
}

export async function translateToLanguage(englishTexts: string[], targetCode: string): Promise<string[]> {
    const model = parseModelFromLanguageCode(targetCode);

    if (model === 'gt') {
        if (!process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_ACCOUNT_EMAIL) {
            throw new Error('Translating with Google requires the environment variables: BLOOM_GOOGLE_TRANSLATION_SERVICE_ACCOUNT_EMAIL. After setting it (and also BLOOM_GOOGLE_SERVICE_PRIVATE_KEY), you may have to restart your terminal.');
        }
        if (!process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_PRIVATE_KEY) {
            throw new Error('Translating with Google requires the environment variables: BLOOM_GOOGLE_TRANSLATION_SERVICE_PRIVATE_KEY. After setting it (and also BLOOM_GOOGLE_SERVICE_ACCOUNT_EMAIL), you may have to restart your terminal.');
        }

        return await translateWithGoogleTranslate(englishTexts, targetCode.split('-x-')[0], process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_ACCOUNT_EMAIL, process.env.BLOOM_GOOGLE_TRANSLATION_SERVICE_PRIVATE_KEY.replace(
            /\\n/g,
            "\n"
        ));
    }
    if (model === 'acts2') {
        return englishTexts.map(text => `[Acts2 pretend] ${text}`);
    }
    if (model === 'piglatin') {
        return englishTexts.map(text => {
            if (!text) return '';
            return text.split(' ').map(word => {
                // Extract leading/trailing punctuation
                const leading = word.match(/^[^a-zA-Z]*/)[0];
                const trailing = word.match(/[^a-zA-Z]*$/)[0];
                const letters = word.slice(leading.length, word.length - trailing.length);

                if (!letters) return word; // Return original if no letters

                // Transform the letters part only
                const transformed = `${letters.slice(1)}${letters[0]}ay`;
                return leading + transformed + trailing;
            }).join(' ');
        });
    }
    else {
        throw new Error(`Unknown translation model ${model}`);
    }
}