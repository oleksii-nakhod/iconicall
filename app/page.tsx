'use client';

import { useState, useRef, useEffect } from 'react';
import { RecordButton } from '@/components/RecordButton';

type Message = {
    role: string;
    content: string;
};

type AnimationFrame = {
    image_base64: string;
    duration: number;
};

export default function Home() {
    const [isLoading, setIsLoading] = useState(false);
    const [currentExpert, setCurrentExpert] = useState<string>('Expert');
    const [conversation, setConversation] = useState<Message[]>([]);
    
    // Animation state
    const [animationFrames, setAnimationFrames] = useState<AnimationFrame[]>([]);
    const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    const audioPlayer = useRef<HTMLAudioElement | null>(null);
    const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Animation player
    useEffect(() => {
        if (!isAnimating || animationFrames.length === 0) return;

        const currentFrame = animationFrames[currentFrameIndex];
        if (!currentFrame) {
            setIsAnimating(false);
            return;
        }

        // Show frame for its duration, then move to next
        animationTimerRef.current = setTimeout(() => {
            if (currentFrameIndex < animationFrames.length - 1) {
                setCurrentFrameIndex(prev => prev + 1);
            } else {
                // Loop back to first frame
                setCurrentFrameIndex(0);
            }
        }, currentFrame.duration * 1000);

        return () => {
            if (animationTimerRef.current) {
                clearTimeout(animationTimerRef.current);
            }
        };
    }, [isAnimating, currentFrameIndex, animationFrames]);

    const handleAudioStop = async (audioBlob: Blob) => {
        setIsLoading(true);
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64Full = reader.result?.toString();
            if (!base64Full) return setIsLoading(false);
            const [header, base64Data] = base64Full.split(',');
            const mime = header.match(/:(.*?);/)?.[1] || 'audio/webm';
            const format = mime.split('/')[1];

            try {
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audio_base64: base64Data,
                        audio_format: format,
                        conversation_history: conversation,
                    }),
                });
                
                if (!res.ok) {
                    throw new Error(`API error: ${res.status}`);
                }
                
                const data = await res.json();

                // Handle response (works with both single image and animation frames)
                if (data.error && !data.image_base64 && !data.animation_frames) {
                    alert(data.error || 'Generation failed. Try rephrasing your question.');
                    setIsLoading(false);
                    return;
                }

                if (!data.conversation_history) {
                    console.error('Invalid response data:', data);
                    throw new Error('Invalid response from API');
                }

                // Handle animation frames OR single image
                if (data.animation_frames && data.animation_frames.length > 0) {
                    setAnimationFrames(data.animation_frames);
                    setCurrentFrameIndex(0);
                    setIsAnimating(true);
                } else if (data.image_base64) {
                    // Single image - create a single-frame "animation"
                    setAnimationFrames([{ image_base64: data.image_base64, duration: 999 }]);
                    setCurrentFrameIndex(0);
                    setIsAnimating(false); // Don't animate single frame
                } else {
                    console.warn('No images available');
                    setIsAnimating(false);
                }

                setCurrentExpert(data.expert_name || 'Expert');
                setConversation(data.conversation_history);

                // Play audio
                if (audioPlayer.current && data.audio_base64) {
                    try {
                        audioPlayer.current.src = `data:audio/wav;base64,${data.audio_base64}`;
                        await audioPlayer.current.play();
                        
                        // Stop animation when audio ends
                        audioPlayer.current.onended = () => {
                            setIsAnimating(false);
                            // Keep showing last frame
                            setCurrentFrameIndex(data.animation_frames.length - 1);
                        };
                    } catch (audioError) {
                        console.error('Audio playback error:', audioError);
                    }
                }
            } catch (e) {
                console.error('Error in handleAudioStop:', e);
                alert('Sorry, there was an error processing your request. Please try again.');
            } finally {
                setIsLoading(false);
            }
        };
    };

    const currentFrameImage = animationFrames[currentFrameIndex]?.image_base64;
    const fallbackImage = 'https://img.freepik.com/free-photo/plain-smooth-green-wall-texture_53876-129746.jpg';

    return (
        <main className="h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#0A0A0F] via-[#0F1A2A] to-[#06131F] relative overflow-hidden">

            {/* Glowing background orbs */}
            <div className="absolute -top-32 -left-20 w-96 h-96 bg-teal-500 blur-[200px] opacity-30 rounded-full" />
            <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-purple-600 blur-[200px] opacity-30 rounded-full" />

            {/* Video Window with Animation */}
            <div className="relative w-full max-w-4xl h-[55vh] rounded-[30px] shadow-[0_0_60px_rgba(0,0,0,0.6)] overflow-hidden transition-all">
                
                {/* Animated Background */}
                <div
                    className="absolute inset-0 bg-cover bg-center transition-all duration-300"
                    style={{ 
                        backgroundImage: `url(${currentFrameImage ? `data:image/jpeg;base64,${currentFrameImage}` : fallbackImage})` 
                    }}
                />

                {/* Frosted Glass Overlay */}
                <div className="absolute inset-0 bg-black/35 backdrop-blur-[2px] flex flex-col justify-between p-6">

                    {/* Expert Name & Animation Status */}
                    <div className="flex items-center gap-3">
                        <span className="bg-black/50 px-5 py-2 text-lg rounded-full font-semibold backdrop-blur-md border border-white/20 shadow-lg">
                            {isLoading ? 'Processing...' : currentExpert}
                        </span>
                        
                        {isAnimating && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-white/70">
                                    🎬 Frame {currentFrameIndex + 1}/{animationFrames.length}
                                </span>
                                <div className="flex gap-1">
                                    {animationFrames.map((_, idx) => (
                                        <div
                                            key={idx}
                                            className={`w-2 h-2 rounded-full transition-all ${
                                                idx === currentFrameIndex 
                                                    ? 'bg-white scale-125' 
                                                    : idx < currentFrameIndex 
                                                        ? 'bg-white/50' 
                                                        : 'bg-white/20'
                                            }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bottom animation loader */}
                    {isLoading && (
                        <div className="flex justify-center pb-4">
                            <div className="flex gap-2">
                                {[1, 2, 3].map((i) => (
                                    <span
                                        key={i}
                                        className="w-3 h-3 bg-white rounded-full animate-bounce"
                                        style={{ animationDelay: `${i * 0.1}s` }}
                                    ></span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat History */}
            <div className="w-full max-w-4xl max-h-56 overflow-y-auto mt-5 rounded-xl p-4 bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl">
                {!conversation || conversation.length === 0 ? (
                    <p className="text-center text-white/50 text-sm italic">
                        🎙️ Press record and ask your question to start!
                    </p>
                ) : (
                    conversation.map((msg, i) => (
                        <div
                            key={i}
                            className={`mb-3 p-3 max-w-[80%] rounded-2xl border backdrop-blur-sm transition-all hover:scale-[1.02]
                            ${msg.role === 'user'
                                ? 'ml-auto bg-gradient-to-r from-[#004DFF]/40 to-[#00E1FF]/40 border-[#00C2FF]/30 shadow-[0_0_15px_rgba(0,194,255,0.3)]'
                                : 'mr-auto bg-gradient-to-r from-[#6D28D9]/40 to-[#A855F7]/40 border-purple-400/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                            }`}
                        >
                            <p className="text-sm leading-relaxed">
                                {msg.role === 'assistant' && '🎓 '}
                                {msg.role === 'user' && '👤 '}
                                {msg.content}
                            </p>
                        </div>
                    ))
                )}
            </div>

            {/* Controls */}
            <div className="mt-8 relative">
                <RecordButton onStop={handleAudioStop} disabled={isLoading} />
                {isLoading && (
                    <p className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-white/50 whitespace-nowrap">
                        Generating animation...
                    </p>
                )}
            </div>

            <audio 
                ref={audioPlayer} 
                style={{ display: 'none' }}
                preload="auto"
            />
        </main>
    );
}