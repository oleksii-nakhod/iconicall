'use client';

import { useState, useRef } from 'react';
import { RecordButton } from '@/components/RecordButton';

// Type for a single message in our history
type Message = {
    role: string;
    content: string;
};

// Type for the API response
type ApiResponse = {
    expert_name: string;
    script_text: string;
    audio_base64: string;
    image_base64: string;
    conversation_history: Message[];
};

export default function Home() {
    const [isLoading, setIsLoading] = useState(false);
    const [currentBackground, setCurrentBackground] = useState<string>('https://img.freepik.com/free-photo/plain-smooth-green-wall-texture_53876-129746.jpg'); // Default BG
    const [currentExpert, setCurrentExpert] = useState<string>('Expert');
    const [conversation, setConversation] = useState<Message[]>([]);

    // Ref to auto-play audio
    const audioPlayer = useRef<HTMLAudioElement | null>(null);

    const handleAudioStop = async (audioBlob: Blob) => {
        setIsLoading(true);

        // Convert Blob to Base64
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
            const base64AudioFull = reader.result?.toString();
            if (!base64AudioFull) {
                setIsLoading(false);
                return;
            }

            const [header, base64Data] = base64AudioFull.split(',');
            const mimeType = header.match(/:(.*?);/)?.[1] || 'audio/webm';
            const format = mimeType.split('/')[1] || 'webm';

            try {
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audio_base64: base64Data,
                        audio_format: format,
                        conversation_history: conversation,
                    }),
                });

                if (!response.ok) {
                    throw new Error(`API Error: ${response.statusText}`);
                }

                const data = await response.json();

                setCurrentBackground(`data:image/jpeg;base64,${data.image_base64}`);
                setCurrentExpert(data.expert_name);
                setConversation(data.conversation_history);

                if (audioPlayer.current) {
                    audioPlayer.current.src = `data:audio/wav;base64,${data.audio_base64}`;
                    audioPlayer.current.play().catch(e => {
                        console.error("Audio play failed:", e);
                    });
                }

            } catch (error) {
                console.error('Failed to process audio:', error);
            } finally {
                setIsLoading(false);
            }
        };
    };

    return (
        <main className="flex h-screen flex-col items-center justify-center p-8 bg-gray-900 text-white">

            {/* 1. The "Video Call" Window */}
            <div
                className="w-full max-w-4xl h-[60vh] bg-gray-700 rounded-lg shadow-2xl transition-all duration-500 bg-cover bg-center"
                style={{ backgroundImage: `url(${currentBackground})` }}
            >
                <div className="w-full h-full bg-black/30 p-6 flex flex-col justify-between">
                    <span className="bg-black/50 px-4 py-2 rounded-full self-start text-lg font-semibold">
                        {isLoading ? 'Thinking...' : currentExpert}
                    </span>

                    {isLoading && (
                        <div className="self-center">
                            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. The Conversation Log (for debugging) */}
            <div className="w-full max-w-4xl mt-4 bg-gray-800 p-4 rounded-lg max-h-48 overflow-y-auto">
                {conversation.map((msg, index) => (
                    <div key={index} className={`mb-2 ${msg.role === 'user' ? 'text-blue-300' : 'text-green-300'}`}>
                        <strong className="capitalize">{msg.role}: </strong>
                        {msg.content}
                    </div>
                ))}
            </div>

            {/* 3. The Controls */}
            <div className="mt-8">
                <RecordButton
                    onStop={handleAudioStop}
                    disabled={isLoading}
                />
            </div>

            {/* 4. Hidden Audio Player */}
            <audio ref={audioPlayer} style={{ display: 'none' }} />

        </main>
    );
}