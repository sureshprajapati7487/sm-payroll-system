import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    subLabel?: string;
    image?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export const SearchableSelect = ({ options, value, onChange, placeholder = "Select...", className = "" }: SearchableSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredOptions = options.filter(option =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.subLabel?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOption = options.find(o => o.value === value);

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-dark-bg border border-dark-border rounded-lg px-3 py-2 text-left text-white focus:border-primary-500 outline-none flex items-center justify-between"
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {selectedOption?.image && (
                        <img src={selectedOption.image} alt="" className="w-5 h-5 rounded-full object-cover" />
                    )}
                    <span className="truncate">
                        {selectedOption ? selectedOption.label : <span className="text-dark-muted">{placeholder}</span>}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-dark-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-dark-card border border-dark-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    {/* Search Input */}
                    <div className="p-2 border-b border-dark-border/50 sticky top-0 bg-dark-card">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-dark-muted" />
                            <input
                                type="text"
                                autoFocus
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search..."
                                className="w-full bg-dark-bg border border-dark-border rounded-md pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary-500"
                            />
                        </div>
                    </div>

                    {/* Options List */}
                    <div className="max-h-60 overflow-y-auto p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md flex items-center justify-between text-sm transition-colors ${option.value === value
                                            ? 'bg-primary-600/20 text-primary-400'
                                            : 'text-white hover:bg-white/5'
                                        }`}
                                >
                                    <div className="flex items-center gap-2 overflow-hidden">
                                        {option.image && (
                                            <img src={option.image} alt="" className="w-6 h-6 rounded-full object-cover" />
                                        )}
                                        <div className="flex flex-col">
                                            <span className="truncate font-medium">{option.label}</span>
                                            {option.subLabel && <span className="text-[10px] text-dark-muted">{option.subLabel}</span>}
                                        </div>
                                    </div>
                                    {option.value === value && <Check className="w-3 h-3 flex-shrink-0" />}
                                </button>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-dark-muted">No results found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
