import React from 'react';
import type { ConfirmationCard as ConfirmationCardType } from '../../types/aiChat';
import { Check, X, AlertCircle, Clock, Loader2 } from 'lucide-react';

interface Props {
    entity: ConfirmationCardType;
    onConfirm: (id: string, decision: 'approve' | 'reject') => void;
}

export const ConfirmationCard: React.FC<Props> = ({ entity, onConfirm }) => {
    const isPending = entity.status === 'pending';
    const isConfirming = entity.status === 'confirming';
    const isExpired = entity.status === 'expired';
    const isConfirmedYes = entity.status === 'confirmed_yes';
    const isConfirmedNo = entity.status === 'confirmed_no';

    return (
        <div className="flex flex-col gap-1 max-w-[85%]">
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-800/80 border border-gray-700/50 space-y-3">
                {/* Preview */}
                <div className="text-sm text-gray-200 leading-relaxed">
                    {entity.preview}
                </div>

                {/* Action label */}
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="px-2 py-0.5 bg-amber-900/40 border border-amber-700/40 text-amber-400 rounded-full font-medium">
                        {entity.actionType}
                    </span>
                </div>

                {/* Status-dependent content */}
                {isPending && (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <button
                                onClick={() => onConfirm(entity.id, 'approve')}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded-lg transition-colors"
                            >
                                <Check size={14} /> Yes, proceed
                            </button>
                            <button
                                onClick={() => onConfirm(entity.id, 'reject')}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-medium rounded-lg transition-colors"
                            >
                                <X size={14} /> Cancel
                            </button>
                        </div>
                        {entity.error && (
                            <div className="flex items-center gap-1.5 text-xs text-red-400">
                                <AlertCircle size={12} /> {entity.error}
                            </div>
                        )}
                    </div>
                )}

                {isConfirming && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Loader2 size={14} className="animate-spin" /> Processing...
                    </div>
                )}

                {isConfirmedYes && (
                    <div className="flex items-center gap-2 text-xs text-green-400 font-medium">
                        <Check size={14} /> Confirmed: Yes
                        {entity.resultSummary && (
                            <span className="text-gray-400 font-normal">— {entity.resultSummary}</span>
                        )}
                    </div>
                )}

                {isConfirmedNo && (
                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                        <X size={14} /> Cancelled
                    </div>
                )}

                {isExpired && (
                    <div className="flex items-center gap-2 text-xs text-amber-400/70">
                        <Clock size={14} /> Expired — please re-run the request
                    </div>
                )}
            </div>
        </div>
    );
};
