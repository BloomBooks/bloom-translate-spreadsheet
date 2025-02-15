// Map of some 2-letter language codes to ISO 639-3 (3-letter) codes
export const iso6393LanguageCodeMap: { [key: string]: string } = {
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

export function convertToIso6393(languageCode: string): string {
    return iso6393LanguageCodeMap[languageCode.toLowerCase()] || languageCode;
}