import { X, Copy, Check, Key } from 'lucide-react';
import { useState } from 'react';
import { Employee } from '@/types';

interface CredentialsModalProps {
    employee: Employee;
    onClose: () => void;
}

export const CredentialsModal = ({ employee, onClose }: CredentialsModalProps) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const text = `User ID: ${employee.code}\nPassword: ${employee.password || ''}`;
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">

                {/* Header */}
                <div className="bg-slate-800/50 p-4 flex justify-between items-center border-b border-slate-700">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Key className="w-4 h-4 text-primary-400" /> Login Credentials
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                            <img src={employee.avatar} alt={employee.name} className="w-full h-full rounded-full object-cover opacity-80" />
                        </div>
                        <div>
                            <h4 className="text-white font-medium">{employee.name}</h4>
                            <p className="text-slate-400 text-sm">{employee.designation}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">User ID / Code</label>
                            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono flex justify-between items-center">
                                <span>{employee.code}</span>
                                <span className="text-xs text-slate-600">({employee.code.length} chars)</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs text-slate-500 uppercase tracking-wider font-bold">Password</label>
                            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-white font-mono flex justify-between items-center">
                                <span>{employee.password || '<Not Set>'}</span>
                                <span className="text-xs text-slate-600">({(employee.password || '').length} chars)</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-xs text-blue-400">
                        <p><strong>Note:</strong> Ask proper casing. "abc" is different from "ABC".</p>
                    </div>

                    <button
                        onClick={handleCopy}
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                        {copied ? 'Copied to Clipboard' : 'Copy Details'}
                    </button>
                </div>
            </div>
        </div>
    );
};
