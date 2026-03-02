import { useState } from 'react';
import { HelpCircle, Book, Search, FileText, PlayCircle } from 'lucide-react';

export const HelpCenter = () => {
    const [searchQuery, setSearchQuery] = useState('');

    const faqs = [
        {
            category: 'Payroll',
            items: [
                { q: 'How is Net Salary calculated?', a: 'Net Salary = (Basic + Allowances) - (PF + ESI + PT + TDS + Deductions).' },
                { q: 'How to rollback a payroll run?', a: 'Go to Payroll > History, select the month, and click "Rollback" to correct mistakes.' },
                { q: 'Can I simulate salary changes?', a: 'Yes! Use the Payroll Simulation tool to test "What-If" scenarios without affecting data.' }
            ]
        },
        {
            category: 'Attendance & Leaves',
            items: [
                { q: 'How to mark attendance manually?', a: 'Go to Attendance Dashboard, search for the employee, and click "Check In/Out".' },
                { q: 'How does the face scan work?', a: 'It uses your device camera to detect faces. Ensure good lighting for best results.' },
                { q: 'What happens if I forget to check out?', a: 'The system will mark it as "Missed Punch" and 0 overtime will be calculated.' }
            ]
        },
        {
            category: 'Tax & Compliance',
            items: [
                { q: 'How to generate Form 16?', a: 'Go to Statutory > Form 16, select the financial year, and click Generate PDF.' },
                { q: 'Is the new tax regime supported?', a: 'Yes, the TDS calculator supports both Old and New Tax Regimes (FY 2024-25).' }
            ]
        }
    ];

    const filteredFaqs = faqs.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
    })).filter(cat => cat.items.length > 0);

    return (
        <div className="p-6 space-y-6">
            <div className="text-center py-8">
                <h1 className="text-4xl font-bold text-white mb-2">How can we help you?</h1>
                <p className="text-dark-muted max-w-2xl mx-auto mb-8">
                    Browse our guides and FAQs to get the most out of SM Payroll System.
                </p>

                <div className="max-w-xl mx-auto relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-muted w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search for help (e.g. 'Payroll', 'Tax', 'Attendance')..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-dark-surface border border-dark-border rounded-full py-4 pl-12 pr-6 text-white focus:ring-2 focus:ring-primary-500 transition-all shadow-lg"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="glass rounded-2xl p-6 hover:border-primary-500/50 transition-all cursor-pointer group">
                    <div className="p-3 bg-blue-500/20 rounded-xl w-fit mb-4">
                        <Book className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400">User Guide</h3>
                    <p className="text-dark-muted text-sm">Comprehensive manuals for Admin, HR, and Employee roles.</p>
                </div>
                <div className="glass rounded-2xl p-6 hover:border-primary-500/50 transition-all cursor-pointer group">
                    <div className="p-3 bg-purple-500/20 rounded-xl w-fit mb-4">
                        <PlayCircle className="w-6 h-6 text-purple-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400">Video Tutorials</h3>
                    <p className="text-dark-muted text-sm">Watch step-by-step videos on how to process payroll and taxes.</p>
                </div>
                <div className="glass rounded-2xl p-6 hover:border-primary-500/50 transition-all cursor-pointer group">
                    <div className="p-3 bg-green-500/20 rounded-xl w-fit mb-4">
                        <FileText className="w-6 h-6 text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400">API Documentation</h3>
                    <p className="text-dark-muted text-sm">Technical docs for integrating with biometric devices.</p>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <HelpCircle className="w-6 h-6 text-primary-500" />
                    Frequently Asked Questions
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filteredFaqs.map((cat, idx) => (
                        <div key={idx} className="glass rounded-2xl p-6 h-fit">
                            <h3 className="text-lg font-semibold text-primary-400 mb-4">{cat.category}</h3>
                            <div className="space-y-4">
                                {cat.items.map((item, i) => (
                                    <div key={i} className="pb-4 border-b border-dark-border last:border-0 last:pb-0">
                                        <div className="font-medium text-white mb-1">{item.q}</div>
                                        <div className="text-dark-muted text-sm">{item.a}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {filteredFaqs.length === 0 && (
                    <div className="text-center py-12 text-dark-muted">
                        No results found for "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
};
