'use client';
import { useState, useRef } from 'react';
import { RecordButton } from '@/components/RecordButton';

type Message = {
    role: string;
    content: string;
};

type StoryState = {
    book_title?: string;
    narrator_name?: string;
    narrators?: string[];
    content_type?: string;
    plot_summary?: string;
    current_chapter?: string;
};

type SceneLine = {
    speakerIndex?: number;
    speakerName?: string;
    text: string;
    color: string;
};

export default function Home() {
    const [isLoading, setIsLoading] = useState(false);
    const [bookTitle, setBookTitle] = useState<string>('');
    const [narratorName, setNarratorName] = useState<string>('Narrator');
    const [currentChapter, setCurrentChapter] = useState<string>('');
    const [conversation, setConversation] = useState<Message[]>([]);
    const [storyState, setStoryState] = useState<StoryState>({});
    
    // Scene state
    const [currentScene, setCurrentScene] = useState<string>('');
    const [currentImage, setCurrentImage] = useState<string>('');
    const [choices, setChoices] = useState<string[]>([]);
    const [loadingProgress, setLoadingProgress] = useState<string>('');
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [performanceData, setPerformanceData] = useState<{
        total_ms: number;
        breakdown: Record<string, number>;
    } | null>(null);

    // Scene lines with proper typing
    const [sceneLines, setSceneLines] = useState<SceneLine[]>([]);

    const audioPlayer = useRef<HTMLAudioElement | null>(null);

    const handleRestart = () => {
        // Stop any playing audio
        if (audioPlayer.current) {
            audioPlayer.current.pause();
            audioPlayer.current.currentTime = 0;
        }
        
        // Reset all state
        setBookTitle('');
        setNarratorName('Narrator');
        setCurrentChapter('');
        setConversation([]);
        setStoryState({});
        setCurrentScene('');
        setCurrentImage('');
        setChoices([]);
        setLoadingProgress('');
        setIsFirstLoad(true);
        setPerformanceData(null);
        setSceneLines([]);
        setIsLoading(false);
    };

    const handleAudioStop = async (audioBlob: Blob) => {
        setIsLoading(true);
        setLoadingProgress('🎤 Listening...');
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Full = reader.result?.toString();
            if (!base64Full) return setIsLoading(false);

            const [header, base64Data] = base64Full.split(',');
            const mime = header.match(/:(.*?);/)?.[1] || 'audio/webm';
            const format = mime.split('/')[1];

            try {
                setLoadingProgress(isFirstLoad ? '🔍 Understanding your request...' : '🎨 Creating scene...');
                
                const startTime = Date.now();
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audio_base64: base64Data,
                        audio_format: format,
                        conversation_history: conversation,
                        story_state: storyState,
                    }),
                });
                
                if (!res.ok) {
                    throw new Error(`API error: ${res.status}`);
                }
                
                const data = await res.json();
                const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`⚡ Scene generated in ${elapsedTime}s`);
                
                // Store performance data
                if (data.performance) {
                    setPerformanceData(data.performance);
                    console.log('📊 Performance Breakdown:', data.performance);
                }

                if (data.error) {
                    alert(data.error || 'Generation failed. Try again.');
                    setIsLoading(false);
                    setLoadingProgress('');
                    return;
                }

                // Handle multi-narrator names
                if (data.narrators && Array.isArray(data.narrators)) {
                    setNarratorName(data.narrators.join(' & '));
                } else if (data.narrator_name) {
                    setNarratorName(data.narrator_name);
                }

                // Set scene lines with proper typing
                setSceneLines(data.scene_lines || []);

                // Update story state
                if (data.book_title) setBookTitle(data.book_title);
                if (data.current_chapter) setCurrentChapter(data.current_chapter);
                setStoryState(data.story_state);
                setConversation(data.conversation_history);
                setCurrentScene(data.scene_text);
                setChoices(data.choices || []);
                setIsFirstLoad(false);

                // Update scene image
                if (data.scene_image?.image_base64) {
                    setCurrentImage(data.scene_image.image_base64);
                }

                // Play narration audio
                if (audioPlayer.current && data.audio_base64) {
                    try {
                        audioPlayer.current.src = `data:audio/wav;base64,${data.audio_base64}`;
                        await audioPlayer.current.play();
                    } catch (audioError) {
                        console.error('Audio playback error:', audioError);
                    }
                }

                setLoadingProgress('');
            } catch (e) {
                console.error('Error:', e);
                alert('Sorry, there was an error. Please try again.');
                setLoadingProgress('');
            } finally {
                setIsLoading(false);
            }
        };
    };

    const handleChoiceClick = async (choice: string) => {
        if (isLoading) return;
        setIsLoading(true);
        setLoadingProgress('🎬 Processing your choice...');

        try {
            const startTime = Date.now();
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text_input: choice,
                    conversation_history: conversation,
                    story_state: storyState,
                }),
            });

            if (!res.ok) throw new Error(`API error: ${res.status}`);

            const data = await res.json();
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`⚡ Next scene in ${elapsedTime}s`);
            
            // Store performance data
            if (data.performance) {
                setPerformanceData(data.performance);
                console.log('📊 Performance Breakdown:', data.performance);
            }

            if (data.error) {
                alert(data.error);
                setIsLoading(false);
                setLoadingProgress('');
                return;
            }

            // Handle multi-narrator names
            if (data.narrators && Array.isArray(data.narrators)) {
                setNarratorName(data.narrators.join(' & '));
            } else if (data.narrator_name) {
                setNarratorName(data.narrator_name);
            }

            setSceneLines(data.scene_lines || []);

            setStoryState(data.story_state);
            setConversation(data.conversation_history);
            setCurrentScene(data.scene_text);
            setChoices(data.choices || []);
            if (data.current_chapter) setCurrentChapter(data.current_chapter);

            if (data.scene_image?.image_base64) {
                setCurrentImage(data.scene_image.image_base64);
            }

            if (audioPlayer.current && data.audio_base64) {
                try {
                    audioPlayer.current.src = `data:audio/wav;base64,${data.audio_base64}`;
                    await audioPlayer.current.play();
                } catch (audioError) {
                    console.error('Audio playback error:', audioError);
                }
            }

            setLoadingProgress('');
        } catch (e) {
            console.error('Error:', e);
            alert('Error processing choice. Try again.');
            setLoadingProgress('');
        } finally {
            setIsLoading(false);
        }
    };

    const fallbackImage = 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=1200';

    // Helper function to get display lines with proper typing
    const getDisplayLines = (): SceneLine[] => {
        if (sceneLines.length > 0) {
            return sceneLines;
        }
        if (currentScene) {
            return currentScene.trim().split(/\n+/).map(text => ({
                text,
                color: 'hsl(0 0% 100%)',
                speakerName: undefined,
                speakerIndex: undefined
            }));
        }
        return [];
    };

    const displayLines = getDisplayLines();

    return (
        <main className="h-screen w-full flex flex-col bg-gradient-to-br from-[#0A0A0F] via-[#1A0F2A] to-[#0F061A] relative overflow-hidden">
            {/* Magical background orbs */}
            <div className="absolute -top-32 -left-20 w-96 h-96 bg-purple-500 blur-[200px] opacity-20 rounded-full" />
            <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-pink-600 blur-[200px] opacity-20 rounded-full" />

            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-start p-6">
                {/* Logo - Top Left */}
                <div>
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="h-16 md:h-20 w-auto object-contain"
                    />
                </div>

                {/* Book Title - Top Center */}
                {bookTitle && (
                    <div className="text-center flex-1 px-8">
                        <h1 className="text-2xl md:text-3xl font-bold text-white/90 tracking-wide">
                            {bookTitle}
                        </h1>
                        <p className="text-sm text-white/50 mt-1">
                            {storyState.content_type === 'learning' ? 'Explained by' : 'Narrated by'} {narratorName}
                        </p>
                        {currentChapter && (
                            <p className="text-xs text-white/40 mt-1 italic">
                                {currentChapter}
                            </p>
                        )}
                    </div>
                )}

                {/* Restart Button - Top Right */}
                {!isFirstLoad && (
                    <button
                        onClick={handleRestart}
                        disabled={isLoading}
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] backdrop-blur-sm border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <span className="text-lg">🔄</span>
                        <span>Restart</span>
                    </button>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex items-center justify-center p-6 pt-24">
                <div className="w-full max-w-7xl h-full flex gap-6">

                    {/* Left: Scene Image + Dialogue */}
                    <div className="flex-1 flex flex-col gap-4 h-full">
                        {/* Scene Image - Bigger */}
                        <div className="relative flex-1 rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden border-2 border-white/10">
                            <div
                                className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
                                style={{
                                    backgroundImage: `url(${currentImage ? `data:image/jpeg;base64,${currentImage}` : fallbackImage})`,
                                    filter: isLoading ? 'blur(8px) brightness(0.7)' : 'none'
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                            {/* Loading Indicator */}
                            {isLoading && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center z-10">
                                    <div className="flex gap-2 justify-center mb-4">
                                        {[1, 2, 3].map((i) => (
                                            <span
                                                key={i}
                                                className="w-4 h-4 bg-white rounded-full animate-bounce"
                                                style={{ animationDelay: `${i * 0.15}s` }}
                                            />
                                        ))}
                                    </div>
                                    <p className="text-white/90 text-lg font-medium">{loadingProgress}</p>
                                </div>
                            )}

                            {/* Welcome Message */}
                            {!currentScene && !isLoading && (
                                <div className="absolute inset-0 flex items-center justify-center text-center p-8">
                                    <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-10 max-w-xl border border-white/20">
                                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                            🎭 Learn Anything, Live Any Story
                                        </h2>
                                        <p className="text-lg md:text-xl text-white/80 mb-6">
                                            Speak a book title to experience its story, or ask about any topic to learn from an expert.
                                        </p>
                                        <div className="text-white/60 space-y-2 text-sm">
                                            <p>📚 <span className="text-white/80">Books:</span> Harry Potter • 1984 • The Hobbit</p>
                                            <p>🎓 <span className="text-white/80">Topics:</span> How do black holes work? • Explain quantum physics</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Dialogue Box - Below Image */}
{displayLines.length > 0 && !isLoading && (
    <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-5 border border-white/10 max-h-48 overflow-y-auto">
        <div className="space-y-3">
            {displayLines.map((line, idx) => {
                // Alternate alignment based on speaker index
                const isEven = line.speakerIndex !== undefined ? line.speakerIndex % 2 === 0 : idx % 2 === 0;
                const alignment = isEven ? 'text-left' : 'text-right';

                // Use the line color directly (no conversion needed)
                const textColor = line.color;

                return (
                    <div key={idx} className={alignment}>
                        <p
                            className="inline-block text-base leading-relaxed whitespace-pre-wrap px-4 py-2 rounded-xl backdrop-blur-sm"
                            style={{
                                color: textColor,
                                backgroundColor: isEven ? 'rgba(139, 92, 246, 0.15)' : 'rgba(94, 234, 212, 0.15)'
                            }}
                        >
                            {line.speakerName && <strong className="opacity-90">{line.speakerName}: </strong>}
                            {line.text}
                        </p>
                    </div>
                );
            })}
        </div>
    </div>
)}
                    </div>

                    {/* Right: Choices */}
                    {choices.length > 0 && !isLoading && (
                        <div className="w-80 flex flex-col gap-3 justify-center">
                            {choices.map((choice, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleChoiceClick(choice)}
                                    className="cursor-pointer px-6 py-4 bg-gradient-to-r from-purple-600/70 to-pink-600/70 hover:from-purple-500 hover:to-pink-500 rounded-2xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] backdrop-blur-sm border border-white/20 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">✨</span>
                                        <span>{choice}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                </div>
            </div>

            {/* Voice Input Button - Bottom Center */}
            <div className="pb-8 flex justify-center relative">
                <RecordButton onStop={handleAudioStop} disabled={isLoading} />
                <p className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/40 whitespace-nowrap">
                    {isFirstLoad ? '🎙️ Say a book or topic to begin' : '🎙️ Or speak your choice'}
                </p>
            </div>

            <audio 
                ref={audioPlayer} 
                style={{ display: 'none' }}
                preload="auto"
            />
        </main>
    );
}