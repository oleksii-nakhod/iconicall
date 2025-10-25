'use client';

import { useState, useRef } from 'react';

type Props = {
    onStop: (audioBlob: Blob) => void;
    disabled: boolean;
};

export const RecordButton = ({ onStop, disabled }: Props) => {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef<MediaRecorder | null>(null);
    const audioChunks = useRef<Blob[]>([]);

    const startRecording = async () => {
        if (disabled) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

            mediaRecorder.current.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };

            mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                onStop(audioBlob);
                audioChunks.current = [];
            };

            mediaRecorder.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder.current) {
            mediaRecorder.current.stop();
            mediaRecorder.current.stream.getTracks().forEach(track => track.stop());

            setIsRecording(false);
        }
    };

    const buttonClass = isRecording
        ? 'bg-red-600 hover:bg-red-700'
        : 'bg-blue-600 hover:bg-blue-700';

    return (
        <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            className={`px-8 py-4 rounded-full text-white font-bold text-lg shadow-lg transition-all ${buttonClass} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            {isRecording ? 'Stop Listening' : (disabled ? 'Thinking...' : 'Start Talking')}
        </button>
    );
};