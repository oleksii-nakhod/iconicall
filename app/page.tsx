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
    content_type?: string;
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
    const [performanceData, setPerformanceData] = useState<any>(null);

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

                // Update story state
                if (data.book_title) setBookTitle(data.book_title);
                if (data.narrator_name) setNarratorName(data.narrator_name);
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

    return (
        <main className="h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#0A0A0F] via-[#1A0F2A] to-[#0F061A] relative overflow-hidden">
            {/* Magical background orbs */}
            <div className="absolute -top-32 -left-20 w-96 h-96 bg-purple-500 blur-[200px] opacity-20 rounded-full" />
            <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-pink-600 blur-[200px] opacity-20 rounded-full" />

            {/* Restart Button - Top Right */}
            {!isFirstLoad && (
                <button
                    onClick={handleRestart}
                    disabled={isLoading}
                    className="absolute top-8 right-8 z-20 px-6 py-3 bg-gradient-to-r from-red-600/80 to-orange-600/80 hover:from-red-500 hover:to-orange-500 rounded-xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] backdrop-blur-sm border border-white/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    <span className="text-xl">🔄</span>
                    <span>New Story</span>
                </button>
            )}

            {/* Book Title Header */}
            {bookTitle && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 text-center">
                    <h1 className="text-3xl font-bold text-white/90 tracking-wide">
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

            {/* Scene Window */}
            <div className="relative w-full max-w-5xl h-[60vh] rounded-[30px] shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden border-4 border-white/10">
                
                {/* Scene Image with Smooth Transitions */}
                <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-1000 ease-in-out"
                    style={{ 
                        backgroundImage: `url(${currentImage ? `data:image/jpeg;base64,${currentImage}` : fallbackImage})`,
                        filter: isLoading ? 'blur(8px) brightness(0.7)' : 'none'
                    }}
                />

                {/* Gradient Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Scene Content */}
                <div className="absolute inset-0 flex flex-col justify-between p-8">
                    {/* Loading Indicator */}
                    {isLoading && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
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
                        <div className="absolute inset-0 flex items-center justify-center text-center">
                            <div className="bg-black/60 backdrop-blur-xl rounded-3xl p-12 max-w-2xl border border-white/20">
                                <h2 className="text-4xl font-bold text-white mb-4">
                                    🎭 Learn Anything, Live Any Story
                                </h2>
                                <p className="text-xl text-white/80 mb-6">
                                    Speak a book title to experience its story, or ask about any topic to learn from an expert.
                                </p>
                                <div className="text-white/60 space-y-2">
                                    <p>📚 <span className="text-white/80">Books:</span> "Harry Potter" • "1984" • "The Hobbit"</p>
                                    <p>🎓 <span className="text-white/80">Topics:</span> "How do black holes work?" • "Explain quantum physics" • "What is photosynthesis?"</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Current Scene Text */}
                    {currentScene && !isLoading && (
                        <div className="mt-auto bg-black/70 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                            <p className="text-lg text-white leading-relaxed">
                                {currentScene}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Choice Buttons */}
            {choices.length > 0 && !isLoading && (
                <div className="w-full max-w-5xl mt-6 flex gap-4 justify-center flex-wrap">
                    {choices.map((choice, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleChoiceClick(choice)}
                            className="cursor-pointer px-6 py-4 bg-gradient-to-r from-purple-600/80 to-pink-600/80 hover:from-purple-500 hover:to-pink-500 rounded-2xl text-white font-medium transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.6)] backdrop-blur-sm border border-white/20 min-w-[200px]"
                        >
                            {choice}
                        </button>
                    ))}
                </div>
            )}

            {/* Voice Input Button */}
            <div className="mt-8 relative">
                <RecordButton onStop={handleAudioStop} disabled={isLoading} />
                <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/40 whitespace-nowrap">
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