import { useState, useEffect } from 'react';
import { Search, User, CheckCircle, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

export const EmployeeSearchableSelect = ({ employees, selectedId, currentUserId, onSelect }: {
    employees: any[],
    selectedId: string,
    currentUserId: string,
    onSelect: (id: string) => void
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Close on click outside
    useEffect(() => {
        const handleClick = () => setIsOpen(false);
        if (isOpen) window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [isOpen]);

    const activeEmployees = employees.filter(e => e.status === 'ACTIVE' && e.id !== currentUserId);
    const filteredOptions = activeEmployees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    const selectedName = selectedId === currentUserId ? 'Myself' : employees.find(e => e.id === selectedId)?.name || 'Select Employee';

    return (
        <div className="relative" onClick={e => e.stopPropagation()}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg pl-3 pr-3 py-2 text-white flex justify-between items-center focus:border-primary-500 outline-none hover:bg-dark-bg/80 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-dark-muted" />
                    <span className="text-sm">{selectedName}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-dark-muted opacity-50" />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-dark-card border border-dark-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 border-b border-dark-border/50 sticky top-0 bg-dark-card">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dark-muted" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Search name..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-dark-bg/50 border border-dark-border rounded-lg pl-8 pr-2 py-1.5 text-xs text-white focus:border-primary-500 outline-none"
                            />
                        </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto p-1 space-y-0.5">
                        <button
                            type="button"
                            onClick={() => { onSelect(currentUserId); setIsOpen(false); }}
                            className={clsx(
                                "w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between group transition-colors",
                                selectedId === currentUserId ? "bg-primary-500/20 text-primary-500" : "text-white hover:bg-white/5"
                            )}
                        >
                            <span>Myself</span>
                            {selectedId === currentUserId && <CheckCircle className="w-3.5 h-3.5" />}
                        </button>

                        {filteredOptions.length === 0 && (
                            <p className="text-[10px] text-dark-muted text-center py-2">No employees found.</p>
                        )}

                        {filteredOptions.map(emp => (
                            <button
                                key={emp.id}
                                type="button"
                                onClick={() => { onSelect(emp.id); setIsOpen(false); }}
                                className={clsx(
                                    "w-full text-left px-3 py-2 text-xs rounded-lg flex items-center justify-between group transition-colors",
                                    selectedId === emp.id ? "bg-primary-500/20 text-primary-500" : "text-white hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <img src={emp.avatar} className="w-5 h-5 rounded-full border border-dark-border bg-dark-bg" />
                                    <span>{emp.name}</span>
                                </div>
                                {selectedId === emp.id && <CheckCircle className="w-3.5 h-3.5" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
