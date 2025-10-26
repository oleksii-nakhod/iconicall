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

        // --------------------------------------------------
        // STEP 1: Speech-to-Text (or use text_input directly)
        // --------------------------------------------------
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
            console.log(`⏱️  STEP 1 - Speech-to-Text: ${timings['1_speech_to_text'].toFixed(2)}ms (${(timings['1_speech_to_text']/1000).toFixed(2)}s)`);
            console.log(`📝 User Input (audio): "${userInput}"`);
        }

        if (!userInput || userInput.trim() === '') {
            return NextResponse.json({
                error: 'Could not transcribe audio. Please try again.'
            }, { status: 400 });
        }

        const isFirstInteraction = !story_state || !story_state.book_title;

        // --------------------------------------------------
        // STEP 2: Generate Content (Story OR Learning)
        // --------------------------------------------------
        stepStartTime = performance.now();
        
        let scriptPrompt: string;
        
        if (isFirstInteraction) {
            // Determine if this is a book request or a learning topic
            scriptPrompt = `You are an AI that creates interactive experiences - either bringing books to life OR teaching topics through engaging narration.

User said: "${userInput}"

Available Narrators (USE EXACT NAMES):
${Object.values(narrators).map(n => `- "${n.name}": ${n.description} (Expertise: ${n.expertise.join(', ')})`).join('\n')}

TASK: Determine if this is a BOOK REQUEST or a LEARNING TOPIC REQUEST.

IF BOOK (e.g., "Harry Potter", "The Great Gatsby"):
- Extract the book title
- Choose narrator that fits the book's genre
- Start at the CANONICAL BEGINNING of the story
- Create opening scene with 2-3 choices aligned with plot points

IF LEARNING TOPIC (e.g., "quantum physics", "how black holes work", "photosynthesis"):
- Identify the topic
- Choose the expert narrator most qualified for this subject
- Create an engaging introduction to the topic
- Provide 2-3 choices for learning directions (deeper dive, related topic, practical example)

Return JSON:
{
  "content_type": "book" or "learning",
  "narrator_name": "EXACT NAME from the list above (copy it exactly with correct capitalization)",
  "book_title": "book title" OR "Learning: [Topic Name]",
  "plot_summary": "brief summary of book plot OR key concepts to cover in this topic",
  "current_chapter": "chapter name OR topic section (e.g., 'Introduction to Quantum Physics')",
  "scene_text": "immersive narration (2-3 sentences) ending with a prompt for choices",
  "choices": ["Choice 1", "Choice 2", "Choice 3"],
  "scene_image": {
    "description": "detailed scene description",
    "duration": 8.0
  }
}

CRITICAL: The narrator_name field MUST be copied EXACTLY from the list above. For example:
- "Stephen Hawking" (correct)
- "stephen hawking" (WRONG - incorrect capitalization)
- "Albert Einstein" (correct)
- "Einstein" (WRONG - incomplete name)

IMPORTANT: 
- For books: Stay true to source material
- For learning: Make it engaging, use analogies, relate to real life
- Match narrator personality to content
- Keep explanations clear and fun

Image requirements:
- Books: Cinematic illustration of the scene
- Learning: Visual representation of the concept (diagrams, illustrations, metaphors)
- Style: "educational illustration, detailed, engaging, clear" for learning OR "cinematic book illustration" for stories
- Keep under 150 characters`;
        } else {
            const recentHistory = (conversation_history || []).slice(-4).map((m: any) =>
                `${m.role === 'user' ? '👤 User' : '📖 Narrator'}: ${m.content}`
            ).join('\n');
            
            const contentType = story_state.content_type || 'book';
            
            if (contentType === 'learning') {
                scriptPrompt = `You are continuing an interactive LEARNING experience about "${story_state.book_title}".

Key Concepts: ${story_state.plot_summary || 'Educational content'}
Current Section: ${story_state.current_chapter || 'Introduction'}
Expert: ${story_state.narrator_name}

Recent Conversation:
${recentHistory}

User's Choice: "${userInput}"

Continue the learning experience:
1. Acknowledge their choice
2. Explain the concept clearly using analogies and examples
3. Build on previous knowledge
4. Provide 2-3 new choices (deeper dive, new angle, related topic)
5. Keep it engaging and interactive

Return JSON:
{
  "current_chapter": "Updated section/concept description",
  "scene_text": "clear, engaging explanation (2-3 sentences) with choice prompt",
  "choices": ["Learn more about X", "How does this relate to Y?", "Show me a real example"],
  "scene_image": {
    "description": "visual representation of this concept",
    "duration": 8.0
  }
}

Image: Educational illustration showing the concept clearly
Style: "educational diagram, clear illustration, engaging visual metaphor"`;
            } else {
                scriptPrompt = `You are continuing an interactive STORY from "${story_state.book_title}".

Plot Summary: ${story_state.plot_summary || 'Follow the canonical story'}
Current Chapter: ${story_state.current_chapter || 'Early story'}
Narrator: ${story_state.narrator_name}

Recent Story:
${recentHistory}

User's Choice: "${userInput}"

Continue the story while maintaining plot fidelity:
1. Acknowledge their choice and show the consequence
2. Progress toward the next major plot point from the actual book
3. Keep characters and events consistent with the source material
4. Present 2-3 new choices that lead to canonical story moments
5. Update the chapter/progress tracker

Return JSON:
{
  "current_chapter": "Updated chapter/section description",
  "scene_text": "engaging continuation (2-3 sentences) with choice prompt",
  "choices": ["Choice aligned with plot", "Choice aligned with plot", "Alternative that still serves the story"],
  "scene_image": {
    "description": "scene matching this moment in the book's progression",
    "duration": 8.0
  }
}

Image: Wide cinematic shot of this scene
Style: "cinematic book illustration, detailed digital art, atmospheric lighting"`;
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
                            narrator_name: { type: 'string' },
                            book_title: { type: 'string' },
                            plot_summary: { type: 'string' },
                            current_chapter: { type: 'string' },
                            scene_text: { type: 'string' },
                            choices: {
                                type: 'array',
                                items: { type: 'string' }
                            },
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
                        required: ['content_type', 'narrator_name', 'book_title', 'plot_summary', 'current_chapter', 'scene_text', 'choices', 'scene_image'],
                    } : {
                        type: 'object',
                        properties: {
                            current_chapter: { type: 'string' },
                            scene_text: { type: 'string' },
                            choices: {
                                type: 'array',
                                items: { type: 'string' }
                            },
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
        console.log(`⏱️  STEP 2 - LLM Script Generation: ${timings['2_llm_script_generation'].toFixed(2)}ms (${(timings['2_llm_script_generation']/1000).toFixed(2)}s)`);

        // --------------------------------------------------
        // STEP 3: Load Reference Files
        // --------------------------------------------------
        stepStartTime = performance.now();
        
        const narratorName = isFirstInteraction ? scriptData.narrator_name : story_state.narrator_name;
        const bookTitle = isFirstInteraction ? scriptData.book_title : story_state.book_title;
        const plotSummary = isFirstInteraction ? scriptData.plot_summary : story_state.plot_summary;
        const currentChapter = scriptData.current_chapter;
        const contentType = isFirstInteraction ? scriptData.content_type : story_state.content_type;
        
        // Robust narrator matching - case insensitive and handles variations
        let narrator = Object.values(narrators).find(n => 
            n.name.toLowerCase() === narratorName.toLowerCase()
        );
        
        // If not found, try partial match
        if (!narrator) {
            narrator = Object.values(narrators).find(n => 
                n.name.toLowerCase().includes(narratorName.toLowerCase()) ||
                narratorName.toLowerCase().includes(n.name.toLowerCase())
            );
        }
        
        // Final fallback
        if (!narrator) {
            console.warn(`⚠️  Narrator "${narratorName}" not found, falling back to David Attenborough`);
            narrator = narrators['david_attenborough'];
        }
        
        console.log(`🔍 Requested narrator: "${narratorName}" → Matched: "${narrator.name}"`);

        console.log(`${contentType === 'learning' ? '🎓' : '📚'} ${contentType === 'learning' ? 'Topic' : 'Book'}: "${bookTitle}"`);
        console.log(`📖 Section: "${currentChapter}"`);
        console.log(`🎙️  Narrator: ${narrator.name}`);
        console.log(`💬 Content: "${scriptData.scene_text}"`);

        const audioPath = path.join(process.cwd(), narrator.ref_audio);
        const transcriptPath = path.join(process.cwd(), narrator.ref_transcript);

        if (!fs.existsSync(audioPath) || !fs.existsSync(transcriptPath)) {
            console.error(`Missing reference files for ${narrator.name}`);
            return NextResponse.json({
                error: `Reference audio/transcript not found for ${narrator.name}`
            }, { status: 500 });
        }

        const refAudioBase64 = await fileToBase64(audioPath);
        const refTranscript = (await fsp.readFile(transcriptPath, 'utf-8')).trim();
        
        timings['3_load_reference_files'] = performance.now() - stepStartTime;
        console.log(`⏱️  STEP 3 - Load Reference Files: ${timings['3_load_reference_files'].toFixed(2)}ms (${(timings['3_load_reference_files']/1000).toFixed(2)}s)`);
        console.log(`   📁 Audio file: ${narrator.ref_audio}`);
        console.log(`   📄 Transcript file: ${narrator.ref_transcript}`);
        console.log(`   🎵 Audio size: ${refAudioBase64.length} chars`);
        console.log(`   📝 Transcript preview: "${refTranscript.substring(0, 50)}..."`);

        // --------------------------------------------------
        // STEP 4: Parallel Generation (Image + Audio)
        // --------------------------------------------------
        const parallelStartTime = performance.now();
        console.log('\n🚀 Starting parallel generation (Image + Audio)...');

        // Image generation
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
                console.log(`   ✅ Image generated: ${imageTime.toFixed(2)}ms (${(imageTime/1000).toFixed(2)}s)`);
                
                return {
                    success: true,
                    data: response,
                    duration: scriptData.scene_image.duration,
                    generationTime: imageTime
                };
            } catch (err: any) {
                const imageTime = performance.now() - imageStartTime;
                console.error(`   ❌ Image generation error (${imageTime.toFixed(2)}ms):`, err.message);
                return { 
                    success: false, 
                    error: err.message,
                    generationTime: imageTime
                };
            }
        })();

        // Audio generation
        const audioGenPromise = (async () => {
            const audioStartTime = performance.now();
            try {
                const response = await (boson.chat.completions as any).create({
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
                        { role: "user", content: `[SPEAKER0] ${scriptData.scene_text}` },
                    ],
                    modalities: ["text", "audio"],
                    max_completion_tokens: 4096,
                    temperature: 1.0,
                    top_p: 0.95,
                    stop: ["<|eot_id|>", "<|end_of_text|>", "<|audio_eos|>"],
                    extra_body: { top_k: 50 },
                });
                
                const audioTime = performance.now() - audioStartTime;
                console.log(`   ✅ Audio generated: ${audioTime.toFixed(2)}ms (${(audioTime/1000).toFixed(2)}s)`);
                
                return {
                    success: true,
                    data: response,
                    generationTime: audioTime
                };
            } catch (err: any) {
                const audioTime = performance.now() - audioStartTime;
                console.error(`   ❌ Audio generation error (${audioTime.toFixed(2)}ms):`, err);
                return { 
                    success: false, 
                    error: err.message,
                    generationTime: audioTime
                };
            }
        })();

        const [imageResult, audioResult] = await Promise.all([
            imagePromise,
            audioGenPromise
        ]);

        timings['4_parallel_generation_total'] = performance.now() - parallelStartTime;
        timings['4a_image_generation'] = imageResult.generationTime || 0;
        timings['4b_audio_generation'] = audioResult.generationTime || 0;
        
        console.log(`⏱️  STEP 4 - Parallel Generation (Total): ${timings['4_parallel_generation_total'].toFixed(2)}ms (${(timings['4_parallel_generation_total']/1000).toFixed(2)}s)`);
        console.log(`   📸 Image only: ${timings['4a_image_generation'].toFixed(2)}ms (${(timings['4a_image_generation']/1000).toFixed(2)}s)`);
        console.log(`   🎵 Audio only: ${timings['4b_audio_generation'].toFixed(2)}ms (${(timings['4b_audio_generation']/1000).toFixed(2)}s)`);
        console.log(`   💡 Speedup: ${Math.max(timings['4a_image_generation'], timings['4b_audio_generation']) > 0 ? ((timings['4a_image_generation'] + timings['4b_audio_generation']) / timings['4_parallel_generation_total']).toFixed(2) : 'N/A'}x faster than sequential`);

        // --------------------------------------------------
        // STEP 5: Process Results
        // --------------------------------------------------
        stepStartTime = performance.now();

        if (!audioResult.success || !audioResult.data?.choices?.[0]?.message?.audio?.data) {
            console.error('Audio result:', audioResult);
            return NextResponse.json({
                error: "Audio generation failed. Please try again."
            }, { status: 500 });
        }

        const generatedAudioBase64 = audioResult.data.choices[0].message.audio.data;

        // Process image
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
                imageDuration = imageResult.duration || 8.0;
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
        console.log(`⏱️  STEP 5 - Process Results: ${timings['5_process_results'].toFixed(2)}ms (${(timings['5_process_results']/1000).toFixed(2)}s)`);

        // --------------------------------------------------
        // FINAL SUMMARY
        // --------------------------------------------------
        const totalTime = performance.now() - totalStartTime;
        timings['TOTAL'] = totalTime;

        console.log('\n📊 === PERFORMANCE SUMMARY ===');
        console.log(`🎯 TOTAL REQUEST TIME: ${totalTime.toFixed(2)}ms (${(totalTime/1000).toFixed(2)}s)`);
        console.log('\nBreakdown:');
        Object.entries(timings).forEach(([step, time]) => {
            const percentage = ((time / totalTime) * 100).toFixed(1);
            console.log(`   ${step}: ${time.toFixed(2)}ms (${(time/1000).toFixed(2)}s) - ${percentage}%`);
        });
        console.log('='.repeat(50) + '\n');

        return NextResponse.json({
            narrator_name: narrator.name,
            book_title: bookTitle,
            current_chapter: currentChapter,
            scene_text: scriptData.scene_text,
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
                narrator_name: narrator.name,
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