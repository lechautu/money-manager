import React from 'react';

export const WaitingIndicator: React.FC = () => {
    return (
        <div className="flex flex-col gap-1 max-w-[85%]">
            <div className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-800/80 border border-gray-700/50">
                <span className="ai-dot size-2 rounded-full bg-blue-400/70" style={{ animationDelay: '0ms' }} />
                <span className="ai-dot size-2 rounded-full bg-blue-400/70" style={{ animationDelay: '200ms' }} />
                <span className="ai-dot size-2 rounded-full bg-blue-400/70" style={{ animationDelay: '400ms' }} />
            </div>
        </div>
    );
};
