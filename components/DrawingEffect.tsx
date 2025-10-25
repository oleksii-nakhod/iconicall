'use client';

import { useEffect, useState } from 'react';

interface DrawingEffectProps {
    imageUrl: string;
    onComplete?: () => void;
    duration?: number;
}

export function DrawingEffect({ imageUrl, onComplete, duration = 3000 }: DrawingEffectProps) {
    const [progress, setProgress] = useState(0);
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const newProgress = Math.min((elapsed / duration) * 100, 100);
            
            setProgress(newProgress);
            
            if (newProgress >= 100) {
                setIsComplete(true);
                onComplete?.();
            } else {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }, [duration, onComplete]);

    return (
        <div className="relative w-full h-full bg-white">
            <div className="absolute inset-0 opacity-30"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23noise)' opacity='0.05'/%3E%3C/svg%3E")`
                }}
            />
            
            <div 
                className="absolute inset-0 transition-all duration-75"
                style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    clipPath: `polygon(0 0, 100% 0, 100% ${progress}%, 0 ${progress}%)`
                }}
            />
            
            {!isComplete && (
                <div 
                    className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-gray-600 to-transparent opacity-50 blur-[1px]"
                    style={{ top: `${progress}%` }}
                />
            )}
            
            {!isComplete && (
                <div 
                    className="absolute -right-4 w-8 h-8 transition-all duration-75"
                    style={{ top: `calc(${progress}% - 16px)` }}
                >
                    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full transform rotate-45">
                        <path d="M3 21L12 12M12 12L21 3M12 12L15 9" 
                              stroke="currentColor" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              className="text-gray-700"
                        />
                        <circle cx="18" cy="6" r="2" fill="#FFD700" className="animate-pulse" />
                    </svg>
                </div>
            )}
            
            {progress < 100 && (
                <div 
                    className="absolute left-0 right-0 pointer-events-none"
                    style={{ top: `${progress}%` }}
                >
                    {[...Array(5)].map((_, i) => (
                        <div
                            key={i}
                            className="absolute w-full h-[1px] bg-gray-400 opacity-20"
                            style={{
                                top: `${i * 3}px`,
                                transform: `skewY(${Math.sin(i) * 2}deg)`
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}