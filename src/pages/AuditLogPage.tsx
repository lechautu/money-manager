
import { useState, useEffect } from 'react';
import { AuditService } from '../services/AuditService';
import type { AuditLog } from '../services/AuditService';
import { Modal } from '../components/ui/Modal';
import { ArrowLeft, ArrowRight, Eye, RefreshCw } from 'lucide-react';
import { formatFullDateTime } from '../utils/dateUtils';

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [page, setPage] = useState(0);
    const [loading, setLoading] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
    const LIMIT = 20;

    const loadLogs = async () => {
        setLoading(true);
        try {
            const data = await AuditService.getLogs(LIMIT, page * LIMIT);
            setLogs(data as AuditLog[]);
        } catch (error) {
            console.error('Failed to load logs', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();
    }, [page]);

    const formatAction = (action: string) => {
        return action.replace(/_/g, ' ').toUpperCase();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Audit Logs</h1>
                <button
                    onClick={loadLogs}
                    className="p-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                    <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-900/50 border-b border-gray-800">
                            <tr>
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Entity</th>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap text-gray-300 font-mono text-xs">
                                        {formatFullDateTime(log.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.action.includes('delete') ? 'bg-red-500/10 text-red-500' :
                                            log.action.includes('create') ? 'bg-emerald-500/10 text-emerald-500' :
                                                log.action.includes('update') ? 'bg-blue-500/10 text-blue-500' :
                                                    'bg-gray-700 text-gray-300'
                                            }`}>
                                            {formatAction(log.action)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 capitalize">{log.entity_type}</td>
                                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{log.entity_id?.slice(0, 8)}...</td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => setSelectedLog(log)}
                                            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                                        No logs found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex justify-between items-center p-4 border-t border-gray-800 text-sm">
                    <button
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <ArrowLeft size={14} /> Previous
                    </button>
                    <span className="text-gray-500">Page {page + 1}</span>
                    <button
                        onClick={() => setPage(p => p + 1)}
                        disabled={logs.length < LIMIT}
                        className="flex items-center gap-1 px-3 py-1 bg-gray-800 rounded hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        Next <ArrowRight size={14} />
                    </button>
                </div>
            </div>

            <Modal
                isOpen={!!selectedLog}
                onClose={() => setSelectedLog(null)}
                title="Audit Log Details"
            >
                {selectedLog && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <label className="block text-xs text-gray-500">Timestamp</label>
                                <div className="text-white font-mono">{formatFullDateTime(selectedLog.created_at)}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">Action</label>
                                <div className="text-white font-medium">{formatAction(selectedLog.action)}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">Entity Type</label>
                                <div className="text-white capitalize">{selectedLog.entity_type}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500">Entity ID</label>
                                <div className="text-white font-mono text-xs">{selectedLog.entity_id}</div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-gray-500 mb-2">Details Payload</label>
                            <pre className="bg-gray-950 p-3 rounded-lg overflow-x-auto text-xs font-mono text-green-400 border border-gray-800">
                                {selectedLog.details ? JSON.stringify(JSON.parse(selectedLog.details), null, 2) : 'No details'}
                            </pre>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
