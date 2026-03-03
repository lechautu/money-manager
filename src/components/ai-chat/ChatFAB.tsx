import React from 'react';
import { Sparkles } from 'lucide-react';

interface Props {
    onClick: () => void;
}

export const ChatFAB: React.FC<Props> = ({ onClick }) => {
    return (
        <button
            onClick={onClick}
            className="fixed bottom-20 right-6 md:bottom-8 md:right-24 w-14 h-14 bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] flex items-center justify-center text-white hover:bg-blue-500 hover:scale-105 active:scale-95 transition-all z-[100] ai-chat-fab"
            title="AI Assistant"
        >
            <Sparkles size={26} />
        </button>
    );
};
