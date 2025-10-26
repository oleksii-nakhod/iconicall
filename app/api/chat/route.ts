import { NextRequest, NextResponse } from 'next/server';
import { getBosonClient, getOpenAIClient } from '@/lib/api-clients';
import { promises as fsp } from "fs";
import fs from "fs";
import path from 'path';

async function fileToBase64(filePath: string): Promise<string> {
    const fileBuffer = await fsp.readFile(filePath);
    return fileBuffer.toString('base64');
}

const narrators = {
    'albert_einstein': {
        name: 'Albert Einstein',
        description: 'Theoretical physicist known for the theory of relativity.',
        ref_audio: 'public/ref-audio/einstein.mp3',
        ref_transcript: 'public/ref-audio/einstein.txt',
        personality: 'Playful genius who uses thought experiments and loves making complex ideas click with "aha!" moments',
        expertise: ['Physics', 'Mathematics', 'Philosophy', 'Science']
    },
    'dipper_pines': {
        name: 'Dipper Pines',
        description: 'Curious and adventurous character from Gravity Falls.',
        ref_audio: 'public/ref-audio/dipper.mp3',
        ref_transcript: 'public/ref-audio/dipper.txt',
        personality: 'Enthusiastic nerd energy, references mysteries and makes everything an adventure',
        expertise: ['Mystery', 'Adventure', 'Puzzles', 'Cryptography']
    },
    'david_attenborough': {
        name: 'David Attenborough',
        description: 'Renowned natural historian and broadcaster famous for his nature documentaries.',
        ref_audio: 'public/ref-audio/attenborough.mp3',
        ref_transcript: 'public/ref-audio/attenborough.txt',
        personality: 'Calm, wise, and deeply reverent toward nature; narrates with wonder, empathy, and quiet enthusiasm for the natural world',
        expertise: ['Nature', 'Biology', 'Ecology', 'Animals', 'Environment']
    },
    'stephen_hawking': {
        name: 'Stephen Hawking',
        description: 'Theoretical physicist known for his work on black holes and cosmology.',
        ref_audio: 'public/ref-audio/hawking.mp3',
        ref_transcript: 'public/ref-audio/hawking.txt',
        personality: 'Dry humor and cosmic curiosity, explains the mysteries of the universe with clarity, patience, and a touch of wit',
        expertise: ['Cosmology', 'Black Holes', 'Space', 'Quantum Physics', 'Universe']
    },
    'kung_fu_panda': {
        name: 'Po',
        description: 'Po, the enthusiastic and food-loving panda who becomes the Dragon Warrior. Martial arts expert',
        ref_audio: 'public/ref-audio/kungfupanda.mp3',
        ref_transcript: 'public/ref-audio/kungfupanda.txt',
        personality: 'Goofy but determined, blends humor, humility, and bursts of kung fu wisdom; always believes anyone can be a hero',
        expertise: ['Martial Arts', 'Self-belief', 'Perseverance', 'Eastern Philosophy']
    },
    'martin_luther': {
        name: 'Martin Luther',
        description: 'German theologian who initiated the Protestant Reformation. Activist.',
        ref_audio: 'public/ref-audio/martinluther.mp3',
        ref_transcript: 'public/ref-audio/martinluther.txt',
        personality: 'Passionate reformer with conviction and moral fire, speaks boldly about truth, faith, and challenging authority',
        expertise: ['Theology', 'History', 'Social Justice', 'Reform', 'Ethics']
    },
    'j_robert_oppenheimer': {
        name: 'Oppenheimer',
        description: 'Theoretical physicist often called the "father of the atomic bomb."',
        ref_audio: 'public/ref-audio/oppenheimer.mp3',
        ref_transcript: 'public/ref-audio/oppenheimer.txt',
        personality: 'Intense and introspective visionary, balances scientific brilliance with moral reflection and haunting eloquence',
        expertise: ['Nuclear Physics', 'Ethics', 'History', 'Science', 'Philosophy']
    },
    'spongebob_squarepants': {
        name: 'SpongeBob SquarePants',
        description: 'Optimistic and energetic sea sponge who lives in a pineapple under the sea.',
        ref_audio: 'public/ref-audio/spongebob.mp3',
        ref_transcript: 'public/ref-audio/spongebob.txt',
        personality: 'Boundless enthusiasm and childlike wonder; turns every task into a fun adventure with positivity and laughter',
        expertise: ['Fun Learning', 'Creativity', 'Friendship', 'Ocean Life', 'Comedy']
    },
    'cher': {
        name: 'Cher',
        description: 'Legendary American singer, actress, and cultural icon celebrated for her powerful contralto voice, fearless style, and lasting influence on pop music and fashion.',
        ref_audio: 'public/ref-audio/cher.mp3',
        ref_transcript: 'public/ref-audio/cher.txt',
        personality: 'Mature, confident, and self-assured; speaks with poise and a touch of dry humor, carrying the presence of someone who\'s seen it all and owns every moment.',
        expertise: ['Music', 'Fashion', 'Pop Culture', 'Entertainment', 'Style']
    }
};

async function fetchImageAsBase64(url: string): Promise<string> {
    const imageRes = await fetch(url);
    const imageBuffer = await imageRes.arrayBuffer();
    return Buffer.from(imageBuffer).toString('base64');
}

function matchNarratorByName(requested: string) {
    let n = Object.values(narrators).find(x => x.name.toLowerCase() === requested.toLowerCase());
    if (n) return n;
    n = Object.values(narrators).find(x =>
        x.name.toLowerCase().includes(requested.toLowerCase()) ||
        requested.toLowerCase().includes(x.name.toLowerCase())
    );
    if (n) return n;
    return narrators['david_attenborough'];
}

export async function POST(req: NextRequest) {
    const totalStartTime = performance.now();
    const timings: Record<string, number> = {};

    try {
        const body = await req.json();
        const { audio_base64, audio_format, text_input, conversation_history, story_state } = body;

        if (!audio_base64 && !text_input) {
            return NextResponse.json({ error: 'No audio or text input provided' }, { status: 400 });
        }

        const boson = getBosonClient();
        const openai = getOpenAIClient();

        console.log('\n🎯 === PERFORMANCE TRACKING START ===');
        let stepStartTime = performance.now();

        let userInput: string;
        if (text_input) {
            userInput = text_input;
            timings['1_speech_to_text'] = 0;
            console.log(`⏱️  STEP 1 - Text Input (skipped STT): 0ms`);
            console.log(`📝 User Input (text): "${userInput}"`);
        } else {
            const audioBuffer = Buffer.from(audio_base64, "base64");
            const tempPath = path.join("/tmp", `audio_${Date.now()}.${audio_format || "webm"}`);
            await fs.promises.writeFile(tempPath, audioBuffer);

            const transcription = await openai.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: process.env.STT_MODEL || 'whisper-1',
            });

            await fs.promises.unlink(tempPath);
            userInput = transcription.text;

            timings['1_speech_to_text'] = performance.now() - stepStartTime;
            console.log(`⏱️  STEP 1 - Speech-to-Text: ${timings['1_speech_to_text'].toFixed(2)}ms (${(timings['1_speech_to_text'] / 1000).toFixed(2)}s)`);
            console.log(`📝 User Input (audio): "${userInput}"`);
        }

        if (!userInput || userInput.trim() === '') {
            return NextResponse.json({ error: 'Could not transcribe audio. Please try again.' }, { status: 400 });
        }

        const isFirstInteraction = !story_state || !story_state.book_title;

        stepStartTime = performance.now();

        let scriptPrompt: string;

        const narratorCatalog =
            Object.values(narrators)
                .map(n => `- "${n.name}": ${n.description} (Expertise: ${n.expertise.join(', ')})`)
                .join('\n');

        if (isFirstInteraction) {
            scriptPrompt = `You create interactive experiences (books or learning topics) with one or more narrators.

User said: "${userInput}"

Available Narrators (USE EXACT NAMES, COPY EXACTLY):
${narratorCatalog}

TASK: Decide if this is a BOOK REQUEST or a LEARNING TOPIC REQUEST.

VOICE CASTING:
- Choose an array "narrators" of 1–3 names (prefer **2** if it makes sense).
- Each line of dialogue in "scene_text" must be prefixed with [SPEAKER0], [SPEAKER1], ... where index corresponds to the narrator order in the "narrators" array.
- Keep indices contiguous starting from 0.

IF BOOK:
- Extract "book_title" (string).
- Start at the canonical beginning.
- "scene_text": 2–6 short lines of dialog/narration, using [SPEAKERi] tags.
- "choices": 2–3 options consistent with the plot.

IF LEARNING:
- "book_title" should be "Learning: [Topic]".
- "scene_text": 2–6 short lines of explanation / Q&A using [SPEAKERi] tags.
- "choices": 2–3 options (deeper dive, related concept, practical example).

Return strict JSON:
{
  "content_type": "book" | "learning",
  "narrators": ["EXACT NAME", "EXACT NAME", ...],  // 1–3, prefer 2
  "book_title": "string",
  "plot_summary": "string",
  "current_chapter": "string",
  "scene_text": "multi-line text with [SPEAKER0], [SPEAKER1], ... tags",
  "choices": ["string", "string", "string"],
  "scene_image": {
    "description": "<=150 chars",
    "duration": 8.0
  }
}

IMPORTANT:
- Names in "narrators" must exactly match Available Narrators.
- Every spoken line in "scene_text" must begin with a tag like [SPEAKER0] or [SPEAKER1].
- Keep explanations clear, fun, and faithful to source (for books).
- Image style: "educational illustration..." for learning or "cinematic book illustration" for books.`;
        } else {
            const recentHistory = (conversation_history || []).slice(-4).map((m: any) =>
                `${m.role === 'user' ? '👤 User' : '📖 Narrator'}: ${m.content}`
            ).join('\n');

            const contentType = story_state.content_type || 'book';

            if (contentType === 'learning') {
                scriptPrompt = `Continue an interactive LEARNING experience about "${story_state.book_title}".
Key Concepts: ${story_state.plot_summary || 'Educational content'}
Current Section: ${story_state.current_chapter || 'Introduction'}
Experts: ${(story_state.narrators || [story_state.narrator_name]).join(', ')}

Recent Conversation:
${recentHistory}

User's Choice: "${userInput}"

RULES:
- Maintain multiple voices using [SPEAKER0], [SPEAKER1], ... per the existing order of narrators.
- 2–6 short lines total.
- Return strict JSON:

{
  "current_chapter": "string",
  "scene_text": "multi-line with [SPEAKERi] tags",
  "choices": ["string", "string", "string"],
  "scene_image": {
    "description": "visual representation (<=150 chars)",
    "duration": 8.0
  }
}

Style: educational diagram, clear illustration, engaging visual metaphor.`;
            } else {
                scriptPrompt = `Continue an interactive STORY from "${story_state.book_title}".
Plot Summary: ${story_state.plot_summary || 'Follow the canonical story'}
Current Chapter: ${story_state.current_chapter || 'Early story'}
Narrators: ${(story_state.narrators || [story_state.narrator_name]).join(', ')}

Recent Story:
${recentHistory}

User's Choice: "${userInput}"

RULES:
- Use [SPEAKER0], [SPEAKER1], ... tags matching the existing narrator order.
- 2–6 short lines total.
- Progress canonically and keep characters/events consistent.
- Return strict JSON:

{
  "current_chapter": "string",
  "scene_text": "multi-line with [SPEAKERi] tags",
  "choices": ["string", "string", "string"],
  "scene_image": {
    "description": "scene (<=150 chars)",
    "duration": 8.0
  }
}

Style: cinematic book illustration, detailed digital art, atmospheric lighting.`;
            }
        }

        const scriptResponse = await openai.responses.create({
            model: process.env.LLM_MODEL || 'gpt-4o',
            input: scriptPrompt,
            text: {
                format: {
                    name: 'generate_interactive_content',
                    schema: isFirstInteraction ? {
                        type: 'object',
                        properties: {
                            content_type: { type: 'string', enum: ['book', 'learning'] },
                            narrators: {
                                type: 'array',
                                items: { type: 'string' },
                                minItems: 1, maxItems: 3
                            },
                            book_title: { type: 'string' },
                            plot_summary: { type: 'string' },
                            current_chapter: { type: 'string' },
                            scene_text: { type: 'string' },
                            choices: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
                            scene_image: {
                                type: 'object',
                                properties: {
                                    description: { type: 'string' },
                                    duration: { type: 'number' }
                                },
                                additionalProperties: false,
                                required: ['description', 'duration']
                            }
                        },
                        additionalProperties: false,
                        required: ['content_type', 'narrators', 'book_title', 'plot_summary', 'current_chapter', 'scene_text', 'choices', 'scene_image'],
                    } : {
                        type: 'object',
                        properties: {
                            current_chapter: { type: 'string' },
                            scene_text: { type: 'string' },
                            choices: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3 },
                            scene_image: {
                                type: 'object',
                                properties: {
                                    description: { type: 'string' },
                                    duration: { type: 'number' }
                                },
                                additionalProperties: false,
                                required: ['description', 'duration']
                            }
                        },
                        additionalProperties: false,
                        required: ['current_chapter', 'scene_text', 'choices', 'scene_image'],
                    },
                    type: 'json_schema',
                }
            }
        });

        const scriptData = JSON.parse(scriptResponse.output_text);

        timings['2_llm_script_generation'] = performance.now() - stepStartTime;
        console.log(`⏱️  STEP 2 - LLM Script Generation: ${timings['2_llm_script_generation'].toFixed(2)}ms (${(timings['2_llm_script_generation'] / 1000).toFixed(2)}s)`);

        stepStartTime = performance.now();

        const contentType = isFirstInteraction ? scriptData.content_type : story_state.content_type;

        const requestedNarrators: string[] = isFirstInteraction
            ? (scriptData.narrators as string[])
            : (story_state.narrators || [story_state.narrator_name]);

        const matchedNarrators = requestedNarrators.map((name, idx) => {
            const matched = matchNarratorByName(name);
            if (matched.name !== name) {
                console.warn(`⚠️ Narrator "${name}" → matched "${matched.name}" (position SPEAKER${idx})`);
            }
            return matched;
        });

        const bookTitle = isFirstInteraction ? scriptData.book_title : story_state.book_title;
        const plotSummary = isFirstInteraction ? scriptData.plot_summary : story_state.plot_summary;
        const currentChapter = scriptData.current_chapter;

        console.log(`${contentType === 'learning' ? '🎓' : '📚'} ${contentType === 'learning' ? 'Topic' : 'Book'}: "${bookTitle}"`);
        console.log(`📖 Section: "${currentChapter}"`);
        console.log(`🎙️  Narrators (order = SPEAKER index): ${matchedNarrators.map(n => n.name).join(' | ')}`);
        console.log(`💬 Content:\n${scriptData.scene_text}`);

        // 🔤 Build a display transcript with speaker names + auto colors (keep tags for TTS)
        const speakerNames = matchedNarrators.map(n => n.name);
        const sceneLines = scriptData.scene_text
            .trim()
            .split(/\n+/)
            .map((l) => {
                const m = l.match(/^\[SPEAKER(\d+)\]\s*(.*)$/);
                const idx = m ? Number(m[1]) : -1;
                const text = m ? m[2] : l;
                const name = idx >= 0 ? (speakerNames[idx] || `Speaker ${idx}`) : '';
                const color = idx >= 0 ? `hsl(${(idx * 137) % 360} 70% 45%)` : `hsl(0 0% 20%)`; // auto color per speaker
                return { speakerIndex: idx, speakerName: name, text, color };
            });
        const displayTranscript = sceneLines
            .map(({ speakerName, text }) => `${speakerName ? speakerName + ': ' : ''}${text}`)
            .join('\n');

        const refBundles = await Promise.all(matchedNarrators.map(async (n, i) => {
            const audioPath = path.join(process.cwd(), n.ref_audio);
            const transcriptPath = path.join(process.cwd(), n.ref_transcript);
            if (!fs.existsSync(audioPath) || !fs.existsSync(transcriptPath)) {
                throw new Error(`Reference audio/transcript not found for ${n.name}`);
            }
            const refAudioBase64 = await fileToBase64(audioPath);
            const refTranscript = (await fsp.readFile(transcriptPath, 'utf-8')).trim();
            console.log(`  📁 [SPEAKER${i}] ${n.name} → audio: ${n.ref_audio} | transcript: ${n.ref_transcript}`);
            return { index: i, narrator: n, refAudioBase64, refTranscript };
        }));

        timings['3_load_reference_files'] = performance.now() - stepStartTime;
        console.log(`⏱️  STEP 3 - Load Reference Files: ${timings['3_load_reference_files'].toFixed(2)}ms (${(timings['3_load_reference_files'] / 1000).toFixed(2)}s)`);

        const parallelStartTime = performance.now();
        console.log('\n🚀 Starting parallel generation (Image + Audio)...');

        const imagePromise = (async () => {
            const imageStartTime = performance.now();
            try {
                const imageStyle = contentType === 'learning'
                    ? 'Educational illustration, clear diagram, engaging visual metaphor, detailed digital art'
                    : 'Cinematic book illustration, detailed digital art, atmospheric lighting, wide establishing shot';

                const response = await openai.images.generate({
                    model: process.env.TTI_MODEL || 'dall-e-3',
                    prompt: `Professional ${contentType === 'learning' ? 'educational' : 'cinematic'} illustration.

Scene: ${scriptData.scene_image.description}

Visual Style:
- Art: ${imageStyle}
- Composition: ${contentType === 'learning' ? 'Clear, informative visual showing the concept' : 'Wide shot showing full scene'}
- Lighting: ${contentType === 'learning' ? 'Clear, bright, easy to understand' : 'Dramatic, atmospheric, mood-appropriate'}
- Quality: Rich colors, ${contentType === 'learning' ? 'educational clarity' : 'immersive storytelling'}

${contentType === 'learning' ? 'Topic' : 'Book'}: "${bookTitle}"
Section: ${currentChapter}
Mood: Engaging, ${contentType === 'learning' ? 'clear, informative' : 'authentic to source material, immersive'}.`,
                    n: 1,
                    size: '1024x1024',
                    quality: 'low'
                });

                const imageTime = performance.now() - imageStartTime;
                console.log(`   ✅ Image generated: ${imageTime.toFixed(2)}ms (${(imageTime / 1000).toFixed(2)}s)`);
                return {
                    success: true,
                    data: response,
                    duration: scriptData.scene_image.duration,
                    generationTime: imageTime
                };
            } catch (err: any) {
                const imageTime = performance.now() - imageStartTime;
                console.error(`   ❌ Image generation error (${imageTime.toFixed(2)}ms):`, err.message);
                return { success: false, error: err.message, generationTime: imageTime };
            }
        })();

        const audioGenPromise = (async () => {
            const audioStartTime = performance.now();
            try {
                const messages: any[] = [
                    {
                        role: "system",
                        content:
                            "You are a multi-voice TTS composer. The assistant is provided with one input_audio per narrator in order. " +
                            "When rendering the user's script, use the corresponding cloned voice whenever a line starts with [SPEAKERi]. " +
                            "Do not output any text; respond with audio only."
                    }
                ];

                for (const b of refBundles) {
                    messages.push({ role: "user", content: b.refTranscript });
                    messages.push({
                        role: "assistant",
                        content: [
                            {
                                type: "input_audio",
                                input_audio: { data: b.refAudioBase64, format: "mp3" },
                            },
                        ],
                    });
                }

                messages.push({ role: "user", content: scriptData.scene_text });

                const response = await (boson.chat.completions as any).create({
                    model: "higgs-audio-generation-Hackathon",
                    messages,
                    modalities: ["text", "audio"],
                    max_completion_tokens: 4096,
                    temperature: 1.0,
                    top_p: 0.95,
                    stop: ["<|eot_id|>", "<|end_of_text|>", "<|audio_eos|>"],
                    extra_body: { top_k: 50 },
                });

                const audioTime = performance.now() - audioStartTime;
                console.log(`   ✅ Audio generated: ${audioTime.toFixed(2)}ms (${(audioTime / 1000).toFixed(2)}s)`);
                return { success: true, data: response, generationTime: audioTime };
            } catch (err: any) {
                const audioTime = performance.now() - audioStartTime;
                console.error(`   ❌ Audio generation error (${audioTime.toFixed(2)}ms):`, err);
                return { success: false, error: err.message, generationTime: audioTime };
            }
        })();

        const [imageResult, audioResult] = await Promise.all([imagePromise, audioGenPromise]);

        timings['4_parallel_generation_total'] = performance.now() - parallelStartTime;
        timings['4a_image_generation'] = imageResult.generationTime || 0;
        timings['4b_audio_generation'] = audioResult.generationTime || 0;

        console.log(`⏱️  STEP 4 - Parallel Generation (Total): ${timings['4_parallel_generation_total'].toFixed(2)}ms (${(timings['4_parallel_generation_total'] / 1000).toFixed(2)}s)`);
        console.log(`   📸 Image only: ${timings['4a_image_generation'].toFixed(2)}ms (${(timings['4a_image_generation'] / 1000).toFixed(2)}s)`);
        console.log(`   🎵 Audio only: ${timings['4b_audio_generation'].toFixed(2)}ms (${(timings['4b_audio_generation'] / 1000).toFixed(2)}s)`);
        console.log(`   💡 Speedup: ${Math.max(timings['4a_image_generation'], timings['4b_audio_generation']) > 0 ? ((timings['4a_image_generation'] + timings['4b_audio_generation']) / timings['4_parallel_generation_total']).toFixed(2) : 'N/A'}x faster than sequential`);

        stepStartTime = performance.now();

        if (!audioResult.success || !audioResult.data?.choices?.[0]?.message?.audio?.data) {
            console.error('Audio result:', audioResult);
            return NextResponse.json({ error: "Audio generation failed. Please try again." }, { status: 500 });
        }
        const generatedAudioBase64 = audioResult.data.choices[0].message.audio.data;

        let imageBase64: string | null = null;
        let imageDuration = 8.0;

        if (imageResult.success && 'data' in imageResult) {
            if (imageResult.data?.data?.[0]) {
                imageBase64 = imageResult.data.data[0].b64_json || null;
                if (!imageBase64 && imageResult.data.data[0].url) {
                    console.log('   🔄 Fetching image from URL...');
                    const urlFetchStart = performance.now();
                    imageBase64 = await fetchImageAsBase64(imageResult.data.data[0].url);
                    console.log(`   ✅ URL fetch: ${(performance.now() - urlFetchStart).toFixed(2)}ms`);
                }
                imageDuration = scriptData.scene_image.duration || 8.0;
                console.log(`   ✅ Image base64 extracted, length: ${imageBase64?.length} chars`);
            }
        }

        if (!imageBase64) {
            console.error('❌ No image base64 after processing');
            return NextResponse.json({
                error: "Image generation failed. Please try again.",
                debug: {
                    imageResult: imageResult.success ? 'success but no data' : 'failed',
                    hasData: 'data' in imageResult
                }
            }, { status: 500 });
        }

        const newHistory = [
            ...(conversation_history || []),
            { role: 'user', content: userInput },
            { role: 'narrator', content: scriptData.scene_text }
        ];

        timings['5_process_results'] = performance.now() - stepStartTime;
        console.log(`⏱️  STEP 5 - Process Results: ${timings['5_process_results'].toFixed(2)}ms (${(timings['5_process_results'] / 1000).toFixed(2)}s)`);

        const totalTime = performance.now() - totalStartTime;
        timings['TOTAL'] = totalTime;

        console.log('\n📊 === PERFORMANCE SUMMARY ===');
        console.log(`🎯 TOTAL REQUEST TIME: ${totalTime.toFixed(2)}ms (${(totalTime / 1000).toFixed(2)}s)`);
        console.log('\nBreakdown:');
        Object.entries(timings).forEach(([step, time]) => {
            const percentage = ((time / totalTime) * 100).toFixed(1);
            console.log(`  ${step}: ${time.toFixed(2)}ms (${(time / 1000).toFixed(2)}s) - ${percentage}%`);
        });
        console.log('='.repeat(50) + '\n');

        return NextResponse.json({
            narrator_names: matchedNarrators.map(n => n.name),
            book_title: bookTitle,
            current_chapter: currentChapter,
            scene_text: displayTranscript,
            scene_lines: sceneLines,
            choices: scriptData.choices,
            audio_base64: generatedAudioBase64,
            scene_image: {
                image_base64: imageBase64,
                duration: imageDuration
            },
            conversation_history: newHistory,
            story_state: {
                content_type: contentType,
                book_title: bookTitle,
                narrators: matchedNarrators.map(n => n.name),
                plot_summary: plotSummary,
                current_chapter: currentChapter,
            },
            performance: {
                total_ms: totalTime,
                breakdown: timings
            }
        });

    } catch (error) {
        const totalTime = performance.now() - totalStartTime;
        console.error(`\n❌ Error after ${totalTime.toFixed(2)}ms:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? String(error) : undefined
        }, { status: 500 });
    }
}
