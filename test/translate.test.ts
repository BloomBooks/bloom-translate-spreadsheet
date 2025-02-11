import { expect, test, describe } from "bun:test";
import { parseModelFromLanguageCode, translateToLanguage } from "../translate";

describe("parseModelFromLanguageCode", () => {
    test("detects acts2 model", () => {
        expect(parseModelFromLanguageCode("es-x-ai-acts2")).toBe("acts2");
    });

    test("detects gt model", () => {
        expect(parseModelFromLanguageCode("fr-x-ai-gt")).toBe("gt");
    });

    test("returns null for unknown model", () => {
        expect(parseModelFromLanguageCode("fr")).toBeNull();
    });
});

describe("translateToLanguage", () => {
    test("handles acts2 model", async () => {
        const texts = ["Hello", "World"];
        const result = await translateToLanguage(texts, "es-x-ai-acts2");
        expect(result).toEqual([
            "[Acts2 pretend] Hello",
            "[Acts2 pretend] World"
        ]);
    });

    test("throws on unknown model", async () => {
        const texts = ["Hello"];
        await expect(translateToLanguage(texts, "invalid")).rejects.toThrow();
    });

    test("translates to pig Latin", async () => {
        const texts = ["hello world", "", "apple"];
        const result = await translateToLanguage(texts, "en-x-ai-piglatin");
        expect(result).toEqual([
            "ellohay orldway",
            "", // the english cell was empty
            "ppleaay"
        ]);
    });
});

// Add new test suite for spreadsheet-specific scenarios
describe("spreadsheet translation scenarios", () => {
    test("handles empty English text", async () => {
        const texts = [""];
        const result = await translateToLanguage(texts, "en-x-ai-piglatin");
        expect(result).toEqual([""]);
    });

    test("handles single word", async () => {
        const texts = ["cat"];
        const result = await translateToLanguage(texts, "en-x-ai-piglatin");
        expect(result).toEqual(["atcay"]);
    });

    test("handles multiple words with punctuation", async () => {
        const texts = ["Hello, World!"];
        const result = await translateToLanguage(texts, "en-x-ai-piglatin");
        expect(result).toEqual(["elloHay, orldWay!"]);
    });
});