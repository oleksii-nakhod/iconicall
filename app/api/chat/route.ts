import { NextRequest, NextResponse } from 'next/server';
import { getBosonClient, getOpenAIClient } from '@/lib/api-clients';
import { promises as fsp } from "fs";
import fs from "fs";
import path from 'path';
// import { ReadStream } from 'fs';

async function fileToBase64(filePath: string): Promise<string> {
    const fileBuffer = await fsp.readFile(filePath);
    return fileBuffer.toString('base64');
}

const experts = {
    'albert_einstein': {
        name: 'Albert Einstein',
        description: 'Theoretical physicist known for the theory of relativity.',
        ref_audio: 'public/ref-audio/einstein.mp3',
        ref_transcript: 'public/ref-audio/einstein.txt',
        personality: 'Playful genius who uses thought experiments and loves making complex ideas click with "aha!" moments',
    },
    'dipper_pines': {
        name: 'Dipper Pines',
        description: 'Curious and adventurous character from Gravity Falls.',
        ref_audio: 'public/ref-audio/dipper.mp3',
        ref_transcript: 'public/ref-audio/dipper.txt',
        personality: 'Enthusiastic nerd energy, references mysteries and makes everything an adventure',
    },
    'winston_churchill': {
        name: 'Winston Churchill',
        description: 'British Prime Minister during World War II, known for his inspiring speeches and leadership.',
        ref_audio: 'public/ref-audio/churchill.mp3',
        ref_transcript: 'public/ref-audio/churchill.txt',
        personality: 'Commanding and motivational, speaks with gravitas and rallying determination, mixing wit with resilience under pressure',
    },
    'david_attenborough': {
        name: 'David Attenborough',
        description: 'Renowned natural historian and broadcaster famous for his nature documentaries.',
        ref_audio: 'public/ref-audio/attenborough.mp3',
        ref_transcript: 'public/ref-audio/attenborough.txt',
        personality: 'Calm, wise, and deeply reverent toward nature; narrates with wonder, empathy, and quiet enthusiasm for the natural world',
    },
    'stephen_hawking': {
        name: 'Stephen Hawking',
        description: 'Theoretical physicist known for his work on black holes and cosmology.',
        ref_audio: 'public/ref-audio/hawking.mp3',
        ref_transcript: 'public/ref-audio/hawking.txt',
        personality: 'Dry humor and cosmic curiosity, explains the mysteries of the universe with clarity, patience, and a touch of wit',
    },
    'kung_fu_panda': {
        name: 'Po',
        description: 'Po, the enthusiastic and food-loving panda who becomes the Dragon Warrior. Martial arts expert',
        ref_audio: 'public/ref-audio/kungfupanda.mp3',
        ref_transcript: 'public/ref-audio/kungfupanda.txt',
        personality: 'Goofy but determined, blends humor, humility, and bursts of kung fu wisdom; always believes anyone can be a hero',
    },
    'martin_luther': {
        name: 'Martin Luther',
        description: 'German theologian who initiated the Protestant Reformation. Activist.',
        ref_audio: 'public/ref-audio/martinluther.mp3',
        ref_transcript: 'public/ref-audio/martinluther.txt',
        personality: 'Passionate reformer with conviction and moral fire, speaks boldly about truth, faith, and challenging authority',
    },
    'j_robert_oppenheimer': {
        name: 'Oppenheimer',
        description: 'Theoretical physicist often called the “father of the atomic bomb.”',
        ref_audio: 'public/ref-audio/oppenheimer.mp3',
        ref_transcript: 'public/ref-audio/oppenheimer.txt',
        personality: 'Intense and introspective visionary, balances scientific brilliance with moral reflection and haunting eloquence',
    },
    'spongebob_squarepants': {
        name: 'SpongeBob SquarePants',
        description: 'Optimistic and energetic sea sponge who lives in a pineapple under the sea.',
        ref_audio: 'public/ref-audio/spongebob.mp3',
        ref_transcript: 'public/ref-audio/spongebob.txt',
        personality: 'Boundless enthusiasm and childlike wonder; turns every task into a fun adventure with positivity and laughter',
    },
    'cher': {
        name: 'Cher',
        description: 'Legendary American singer, actress, and cultural icon celebrated for her powerful contralto voice, fearless style, and lasting influence on pop music and fashion.',
        ref_audio: 'public/ref-audio/cher.mp3',
        ref_transcript: 'public/ref-audio/cher.txt',
        personality: 'Mature, confident, and self-assured; speaks with poise and a touch of dry humor, carrying the presence of someone who’s seen it all and owns every moment.',
    },
};

// Helper to fetch image and convert to base64
async function fetchImageAsBase64(url: string): Promise<string> {
    const imageRes = await fetch(url);
    const imageBuffer = await imageRes.arrayBuffer();
    return Buffer.from(imageBuffer).toString('base64');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { audio_base64, audio_format, conversation_history } = body;

        if (!audio_base64) {
            return NextResponse.json({ error: 'No audio data provided' }, { status: 400 });
        }

        const boson = getBosonClient();
        const openai = getOpenAIClient();

        // --------------------------------------------------
        // STEP 1: Speech-to-Text
        // --------------------------------------------------
        const audioBuffer = Buffer.from(audio_base64, "base64");
        const tempPath = path.join("/tmp", `audio_${Date.now()}.${audio_format || "webm"}`);
        await fs.promises.writeFile(tempPath, audioBuffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempPath),
            model: process.env.STT_MODEL || 'whisper-1',
        });

        await fs.promises.unlink(tempPath);
        const userTranscript = transcription.text;
        console.log("User Transcript:", userTranscript);

        if (!userTranscript || userTranscript.trim() === '') {
            return NextResponse.json({
                error: 'Could not transcribe audio. Please try again.'
            }, { status: 400 });
        }

        const newHistory = [
            ...(conversation_history || []),
            { role: 'user', content: userTranscript }
        ];

        // Check if this is the first interaction (greeting frame)
        const isFirstInteraction = newHistory.length === 1;

        // --------------------------------------------------
        // STEP 2: Enhanced LLM Script Generation
        // --------------------------------------------------
        const conversationContext = newHistory.slice(-5).map((m) =>
            `${m.role === 'user' ? '👤 User' : '🎓 Expert'}: ${m.content}`
        ).join('\n');

        const scriptGenPrompt = `You are an AI that picks the perfect expert to explain a topic in an engaging video call.

Available Experts:
${Object.values(experts).map(e => `- ${e.name}: ${e.description}\n  Vibe: ${e.personality}`).join('\n')}

Recent Conversation:
${conversationContext}

Current User Question: "${userTranscript}"

Generate the next teaching moment that:
1. **Callbacks**: Reference something the user said earlier if possible (makes it feel personal)
2. **Humor**: Use analogies, memes, or pop culture. Be witty but not cringe.
3. **Engagement**: End with a hook question that makes them want to respond
4. **Brevity**: 2-3 sentences MAX. This is a conversation, not a lecture.
5. **Energy**: Match the expert's personality - Einstein is cheeky-genius, Dipper is mystery-hunter vibes

Return JSON with animation frames:
{
  "expert_name": "exact name from list",
  "script_chunk": "engaging explanation with personality",
  "animation_frames": [
    {"description": "frame 1 description", "duration": 1.0},
    {"description": "frame 2 description", "duration": 1.5},
    {"description": "frame 3 description", "duration": 1.5}
  ]
}

Animation frame rules:
- Frame 1: ${isFirstInteraction ? 'Expert waving hello with friendly smile, welcoming gesture' : 'Expert starting the explanation, initial pose'}
- Frame 2-3: Expert demonstrating the concept with visual aids
- Each frame: "expressive cartoon illustration, hand-drawn animation style"
- Focus on CLEAR, SIMPLE visuals that tell the story
- Example frame: "Einstein pointing at glowing equation on chalkboard, excited expression"`;

        const scriptResponse = await openai.responses.create({
            model: process.env.LLM_MODEL || 'gpt-4o',
            input: scriptGenPrompt,
            text: {
                format: {
                    name: 'generate_expert_script',
                    schema: {
                        type: 'object',
                        properties: {
                            expert_name: { type: 'string' },
                            script_chunk: { type: 'string' },
                            animation_frames: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        description: { type: 'string' },
                                        duration: { type: 'number' }
                                    },
                                    additionalProperties: false,
                                    required: ['description', 'duration']
                                }
                            }
                        },
                        additionalProperties: false,
                        required: ['expert_name', 'script_chunk', 'animation_frames'],
                    },
                    type: 'json_schema',
                }
            }
        });

        const { expert_name, script_chunk, animation_frames } = JSON.parse(scriptResponse.output_text);
        const expert = Object.values(experts).find(e => e.name === expert_name) || experts['albert_einstein'];

        console.log("Selected Expert:", expert.name);
        console.log("Script:", script_chunk);
        console.log("Animation Frames:", animation_frames);

        // --------------------------------------------------
        // STEP 3: Generate Voice (Parallel with images)
        // --------------------------------------------------
        const audioPath = path.join(process.cwd(), expert.ref_audio);
        const transcriptPath = path.join(process.cwd(), expert.ref_transcript);

        if (!fs.existsSync(audioPath) || !fs.existsSync(transcriptPath)) {
            console.error(`Missing reference files for ${expert.name}`);
            return NextResponse.json({
                error: `Reference audio/transcript not found for ${expert.name}`
            }, { status: 500 });
        }

        const refAudioBase64 = await fileToBase64(audioPath);
        const refTranscript = (await fsp.readFile(transcriptPath, 'utf-8')).trim();

        // --------------------------------------------------
        // STEP 4: Generate Multiple Frames in Parallel
        // --------------------------------------------------
        // Sanitize prompts to avoid moderation issues
        const sanitizePrompt = (desc: string) => {
            return desc
                .replace(/weapon/gi, 'tool')
                .replace(/attack/gi, 'action')
                .replace(/battle/gi, 'scene')
                .replace(/fight/gi, 'activity');
        };

        const framePromises = animation_frames.map((frame: any) =>
            openai.images.generate({
                model: process.env.TTI_MODEL || 'dall-e-3',
                prompt: `Friendly educational cartoon illustration in hand-drawn animation style.
Character: ${expert.name} (animated, expressive, welcoming personality)
Scene: ${sanitizePrompt(frame.description)}
Art style: Colorful, simple shapes, bold outlines, playful and educational.
Setting: Clean whiteboard background with simple doodles and diagrams.
Mood: Positive, educational, family-friendly, enthusiastic learning atmosphere.`,
                n: 1,
                size: '1024x1024'
            }).catch((err: Error) => {
                console.error('Image generation error:', err);
                return null;
            })
        );

        const audioGenPromise = (boson.chat.completions as any).create({
            model: "higgs-audio-generation-Hackathon",
            messages: [
                { role: "user", content: refTranscript },
                {
                    role: "assistant",
                    content: [
                        {
                            type: "input_audio",
                            input_audio: { data: refAudioBase64, format: "mp3" },
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
        }).catch((err: Error) => {
            console.error('Audio generation error:', err);
            return null;
        });

        // Wait for all generations
        const [audioGenResponse, ...frameResponses] = await Promise.all([
            audioGenPromise,
            ...framePromises
        ]);

        // Validate audio
        const generatedAudioBase64 = audioGenResponse?.choices?.[0]?.message?.audio?.data;
        if (!generatedAudioBase64) {
            return NextResponse.json({
                error: "Audio generation failed. Please try again."
            }, { status: 500 });
        }

        // Process frame images
        const framesBase64 = await Promise.all(
            frameResponses.map(async (response, idx) => {
                if (!response?.data?.[0]) {
                    console.error(`Frame ${idx} generation failed`);
                    return null;
                }

                let imageBase64 = response.data[0].b64_json;

                if (!imageBase64 && response.data[0].url) {
                    imageBase64 = await fetchImageAsBase64(response.data[0].url);
                }

                return {
                    image_base64: imageBase64,
                    duration: animation_frames[idx].duration
                };
            })
        );

        // Filter out failed frames
        const validFrames = framesBase64.filter(f => f && f.image_base64);

        if (validFrames.length === 0) {
            return NextResponse.json({
                error: "Image generation failed. Please try again."
            }, { status: 500 });
        }

        // --------------------------------------------------
        // STEP 4: Image Generation
        // --------------------------------------------------
        // const imageResponse = await openai.images.generate({
        //     model: process.env.TTI_MODEL,
        //     prompt: image_prompt,
        //     n: 1,
        //     size: '1024x1024',
        //     quality: 'low'
        // });
        // console.log("Image Response:", imageResponse);
        // if (!imageResponse.data || !imageResponse.data[0] || !imageResponse.data[0].b64_json) {
        //     throw new Error("Image generation failed, no image data returned.");
        // }

        // --------------------------------------------------
        // STEP 5: Send Response to Frontend
        // --------------------------------------------------
        // Add the assistant's response to the history for the *next* turn
        const finalHistory = [
            ...newHistory,
            { role: expert.name, content: script_chunk }
        ];

        return NextResponse.json({
            expert_name: expert.name,
            script_text: script_chunk,
            audio_base64: generatedAudioBase64,
            animation_frames: validFrames, // Array of frames with durations
            conversation_history: finalHistory,
        });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? String(error) : undefined
        }, { status: 500 });
    }
}
