// lib/api-clients.ts
import OpenAI from 'openai';

let bosonClient: OpenAI | null = null;
let openAIClient: OpenAI | null = null;

export function getBosonClient(): OpenAI {
    if (!bosonClient) {
        if (!process.env.BOSON_API_KEY) {
            throw new Error("BOSON_API_KEY is not set in .env");
        }
        bosonClient = new OpenAI({
            apiKey: process.env.BOSON_API_KEY,
            baseURL: "https://hackathon.boson.ai/v1",
        });
    }
    return bosonClient;
}

export function getOpenAIClient(): OpenAI {
    if (!openAIClient) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY is not set in .env");
        }
        openAIClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }
    return openAIClient;
}