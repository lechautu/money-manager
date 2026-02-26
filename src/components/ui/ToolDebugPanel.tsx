import React, { useState } from 'react';
import toolsManifest from '../../../instruct/05-AI-Tools/tools_manifest_v1.json';
import { ToolExecutionService } from '../../services/ToolExecutionService';

export const ToolDebugPanel: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedTool, setSelectedTool] = useState(toolsManifest.tools[0].name);
    const [parameters, setParameters] = useState('{\n  \n}');
    const [output, setOutput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleExecute = async () => {
        setLoading(true);
        setOutput('Executing...');
        try {
            const parsedParams = JSON.parse(parameters);
            const result = await ToolExecutionService.executeTool(selectedTool, parsedParams);
            setOutput(JSON.stringify(result, null, 2));
        } catch (error: any) {
            setOutput(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handlePreFill = (toolName: string) => {
        setSelectedTool(toolName);
        const tool = toolsManifest.tools.find(t => t.name === toolName);
        if (tool && tool.parameters && tool.parameters.properties) {
            const template: any = {};
            Object.keys(tool.parameters.properties).forEach(key => {
                const prop = (tool.parameters.properties as any)[key];
                template[key] = prop.default !== undefined ? prop.default : `[${prop.type}]`;
            });
            setParameters(JSON.stringify(template, null, 2));
        } else {
            setParameters('{}');
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-20 left-6 md:bottom-8 md:left-8 bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-indigo-600 z-50 flex items-center justify-center group border border-gray-700"
                title="AI Tool Debugger"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
            </button>
        );
    }

    const currentTool = toolsManifest.tools.find(t => t.name === selectedTool);

    return (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Tool Debugger
                </h2>
                <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-700">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

                {/* Tool Selector */}
                <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Select Tool</label>
                    <select
                        className="w-full border border-gray-300 rounded-md p-2 text-sm text-gray-900 bg-white focus:ring-indigo-500 focus:border-indigo-500"
                        value={selectedTool}
                        onChange={(e) => handlePreFill(e.target.value)}
                    >
                        {toolsManifest.tools.map(tool => (
                            <option key={tool.name} value={tool.name} className="text-gray-900">
                                [Tier {tool.tier}] {tool.name}
                            </option>
                        ))}
                    </select>
                    {currentTool && (
                        <p className="text-xs text-gray-500 mt-1">{currentTool.description}</p>
                    )}
                </div>

                {/* Parameters JSON */}
                <div className="flex flex-col gap-1 flex-1">
                    <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-gray-700">Parameters (JSON)</label>
                        <button
                            onClick={() => handlePreFill(selectedTool)}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                            Reset Template
                        </button>
                    </div>
                    <textarea
                        className="w-full h-32 font-mono text-sm text-gray-900 bg-white border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={parameters}
                        onChange={(e) => setParameters(e.target.value)}
                        placeholder="{}"
                    />
                </div>

                {/* Execute Button */}
                <button
                    onClick={handleExecute}
                    disabled={loading}
                    className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                        ${loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} 
                        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                >
                    {loading ? 'Executing...' : 'Execute Tool'}
                </button>

                {/* Output Area */}
                <div className="flex flex-col gap-1 flex-1">
                    <label className="text-sm font-medium text-gray-700">Output Result</label>
                    <div className="relative flex-1 bg-gray-900 rounded-md overflow-hidden min-h-[200px]">
                        <pre className="absolute inset-0 p-3 text-xs text-green-400 font-mono overflow-auto whitespace-pre-wrap">
                            {output || 'Ready.'}
                        </pre>
                    </div>
                </div>
            </div>
        </div>
    );
};
