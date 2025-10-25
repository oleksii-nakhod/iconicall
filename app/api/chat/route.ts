import { NextRequest, NextResponse } from 'next/server';
import { getBosonClient, getOpenAIClient } from '@/lib/api-clients';
import { promises as fsp } from "fs";
import fs from "fs";
import path from 'path';
// import { ReadStream } from 'fs';

// Helper function to encode files for APIs
async function fileToBase64(filePath: string): Promise<string> {
    const fileBuffer = await fsp.readFile(filePath);
    return fileBuffer.toString('base64');
}
// 1. Define our "Expert" map
const experts = {
    'albert_einstein': {
        name: 'Albert Einstein',
        description: 'Theoretical physicist known for the theory of relativity.',
        ref_audio: 'public/ref-audio/einstein.mp3',
        ref_transcript: 'public/ref-audio/einstein.txt',
    },
    'dipper_pines': {
        name: 'Dipper Pines',
        description: 'Curious and adventurous character from Gravity Falls.',
        ref_audio: 'public/ref-audio/dipper.mp3',
        ref_transcript: 'public/ref-audio/dipper.txt',
    },
};

export async function POST(req: NextRequest) {
    try {
        const { audio_base64, audio_format, conversation_history } = await req.json();

        // Initialize API Clients
        const boson = getBosonClient();
        const openai = getOpenAIClient();

        // --------------------------------------------------
        // STEP 1: Speech-to-Text (User's topic)
        // --------------------------------------------------
        // const sttResponse = await boson.chat.completions.create({
        //     model: 'higgs-audio-understanding-Hackathon',
        //     messages: [
        //         { role: 'system', content: 'Transcribe the audio.' },
        //         {
        //             role: 'user',
        //             content: [
        //                 {
        //                     type: 'input_audio',
        //                     input_audio: { data: audio_base64, format: audio_format || 'webm' },
        //                 },
        //             ],
        //         },
        //     ],
        //     temperature: 0.0,
        // });
        // const userTranscript = sttResponse.choices[0].message.content || 'I have a question.';

        const audioBuffer = Buffer.from(audio_base64, "base64");
        const tempPath = path.join("/tmp", `audio.${audio_format || "webm"}`);
        await fs.promises.writeFile(tempPath, audioBuffer);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: process.env.STT_MODEL!,
        });
        await fs.promises.unlink(tempPath);

        const userTranscript = transcription.text;

        console.log("User Transcript:", userTranscript);

        // Add user's new message to history
        const newHistory = [
            ...conversation_history,
            { role: 'user', content: userTranscript }
        ];

        // --------------------------------------------------
        // STEP 2: LLM Logic (Choose Expert & Generate Script)
        // --------------------------------------------------
        // Find the expert based on the *first* user message
        const firstUserMessage = newHistory.find(m => m.role === 'user')?.content || userTranscript;

        const scriptGenPrompt = `
        A user is asking you about: "${firstUserMessage}".
        You are the most relevant expert from this list: ${experts}.
        Your conversation history is:
        ${JSON.stringify(newHistory.slice(-5))}
    `;

        const scriptResponse = await openai.responses.create({
            model: process.env.LLM_MODEL,
            input: scriptGenPrompt,
            text: {
                format: {
                    name: 'generate_expert_script',
                    schema: {
                        type: 'object',
                        properties: {
                            expert_name: {
                                type: 'string',
                                description: 'The name of the expert.',
                            },
                            script_chunk: {
                                type: 'string',
                                description: 'The next 1-2 sentences of the expert explanation.',
                            },
                            image_prompt: {
                                type: 'string',
                                description: 'A concise prompt for a text-to-image model to generate an illustration.',
                            }
                        },
                        additionalProperties: false,
                        required: ['expert_name', 'script_chunk', 'image_prompt'],
                    },
                    type: 'json_schema',
                }
            }
        });

        const { expert_name, script_chunk, image_prompt } = JSON.parse(scriptResponse.output_text);
        const expert = Object.values(experts).find(e => e.name === expert_name) || experts['albert_einstein'];
        console.log("Selected Expert:", expert.name);
        console.log("LLM Script Chunk:", script_chunk);
        console.log("Image Prompt:", image_prompt);

        // --------------------------------------------------
        // STEP 3: Voice Cloning (Higgs)
        // --------------------------------------------------
        // Get the absolute path for a file in /public
        const audioPath = path.join(process.cwd(), expert.ref_audio);
        const transcriptPath = path.join(process.cwd(), expert.ref_transcript);

        const refAudioBase64 = await fileToBase64(audioPath);
        const refTranscript = (await fsp.readFile(transcriptPath, 'utf-8')).trim();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const audioGenResponse = await (boson.chat.completions as any).create({
            model: "higgs-audio-generation-Hackathon",
            messages: [
                { role: "user", content: refTranscript },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "input_audio",
                            input_audio: { data: refAudioBase64, format: "wav" },
                        },
                    ],
                },
                { role: "user", content: `[SPEAKER0] ${script_chunk}` },
            ],
            modalities: ["text", "audio"],
            max_completion_tokens: 4096,
            temperature: 1.0,
            top_p: 0.95,
            stop: ["<|eot_id|>", "<|end_of_text|>", "<|audio_eos|>"],
            extra_body: { top_k: 50 },
        });

        const generatedAudioBase64 = audioGenResponse.choices?.[0]?.message?.audio?.data;
        if (!generatedAudioBase64) {
            throw new Error("Audio generation failed, no audio data returned.");
        }

        // --------------------------------------------------
        // STEP 4: Image Generation
        // --------------------------------------------------
        const imageResponse = await openai.images.generate({
            model: process.env.TTI_MODEL,
            prompt: image_prompt,
            n: 1,
            size: '1024x1024',
            quality: 'low'
        });
        console.log("Image Response:", imageResponse);
        if (!imageResponse.data || !imageResponse.data[0] || !imageResponse.data[0].b64_json) {
            throw new Error("Image generation failed, no image data returned.");
        }

        // --------------------------------------------------
        // STEP 5: Send Response to Frontend
        // --------------------------------------------------
        // Add the assistant's response to the history for the *next* turn
        const finalHistory = [
            ...newHistory,
            { role: 'assistant', content: script_chunk }
        ];

        return NextResponse.json({
            expert_name: expert.name,
            script_text: script_chunk,
            audio_base64: generatedAudioBase64,
            image_base64: imageResponse.data[0].b64_json,
            conversation_history: finalHistory,
        });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}