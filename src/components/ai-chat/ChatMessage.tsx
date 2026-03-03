import React from 'react';
import type { UserMessage, AssistantMessage, SystemMessage } from '../../types/aiChat';
import { RotateCcw } from 'lucide-react';

interface Props {
    entity: UserMessage | AssistantMessage | SystemMessage;
    onRetry?: (id: string) => void;
}

export const ChatMessage: React.FC<Props> = ({ entity, onRetry }) => {
    // System divider
    if (entity.type === 'system') {
        return (
            <div className="flex justify-center py-3">
                <span className="px-3 py-1 text-xs text-gray-400 bg-gray-800/50 rounded-full border border-gray-700/50">
                    {entity.content}
                </span>
            </div>
        );
    }

    // User message
    if (entity.type === 'user') {
        const msg = entity as UserMessage;
        return (
            <div className="flex flex-col gap-1 items-end ml-auto max-w-[85%]">
                <div
                    className={`px-4 py-2.5 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap shadow-lg ${msg.status === 'failed'
                            ? 'bg-red-900/60 text-red-200 border border-red-700/50'
                            : msg.status === 'sending'
                                ? 'bg-blue-600/70 text-white'
                                : 'bg-blue-600 text-white'
                        }`}
                >
                    {msg.content}
                </div>
                {msg.status === 'failed' && (
                    <div className="flex items-center gap-2 mr-1">
                        <span className="text-xs text-red-400">{msg.error || 'Failed'}</span>
                        {onRetry && (
                            <button
                                onClick={() => onRetry(msg.id)}
                                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                <RotateCcw size={12} />
                                Retry
                            </button>
                        )}
                    </div>
                )}
                {msg.status === 'sending' && (
                    <span className="text-[10px] text-gray-500 mr-1">Sending...</span>
                )}
            </div>
        );
    }

    // Assistant message
    return (
        <div className="flex flex-col gap-1 max-w-[85%]">
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-sm bg-gray-800/80 border border-gray-700/50 text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                {(entity as AssistantMessage).content}
            </div>
        </div>
    );
};
