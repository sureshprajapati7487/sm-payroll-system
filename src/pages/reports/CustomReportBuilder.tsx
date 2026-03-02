import { useState } from 'react';
import { FileBarChart, Save, Download, GripVertical, Eye, EyeOff } from 'lucide-react';
import { useCustomReportStore, ReportColumn } from '@/store/customReportStore';
import { useEmployeeStore } from '@/store/employeeStore';

export const CustomReportBuilder = () => {
    const { availableColumns, saveTemplate, templates } = useCustomReportStore();
    const { employees } = useEmployeeStore();

    // State for builder
    const [reportName, setReportName] = useState('');
    const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>(availableColumns);
    const [activeTab, setActiveTab] = useState<'build' | 'preview'>('build');
    const [previewData, setPreviewData] = useState<any[]>([]);

    const toggleColumn = (id: string) => {
        setSelectedColumns(cols => cols.map(c =>
            c.id === id ? { ...c, visible: !c.visible } : c
        ));
    };

    const handleSaveTemplate = () => {
        if (!reportName) return;

        saveTemplate({
            name: reportName,
            description: `Custom report with ${selectedColumns.filter(c => c.visible).length} columns`,
            columns: selectedColumns,
            filters: []
        });

        alert('Report template saved successfully!');
        setReportName('');
    };

    const generatePreview = () => {
        // Mock data merging logic - in production, this would join actual data tables
        const visibleCols = selectedColumns.filter(c => c.visible);

        const data = employees.slice(0, 5).map(emp => {
            const row: Record<string, any> = {};
            visibleCols.forEach(col => {
                // Determine source based on category (simplified mock logic)
                if (col.category === 'employee') {
                    row[col.label] = (emp as any)[col.field] || '-';
                } else if (col.category === 'payroll') {
                    row[col.label] = col.field === 'basicSalary' ? `₹${(emp as any).salary?.toLocaleString() || '0'}` : '₹0';
                } else {
                    row[col.label] = '-';
                }
            });
            return row;
        });

        setPreviewData(data);
        setActiveTab('preview');
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <FileBarChart className="w-8 h-8 text-primary-500" />
                        Custom Report Builder
                    </h1>
                    <p className="text-dark-muted mt-1">Design your own reports by selecting columns and filters</p>
                </div>

                <div className="flex gap-3">
                    <div className="flex bg-dark-surface rounded-lg p-1">
                        <button
                            onClick={() => setActiveTab('build')}
                            className={`px-4 py-2 rounded-md transition-all ${activeTab === 'build' ? 'bg-primary-500 text-white' : 'text-dark-muted hover:text-white'
                                }`}
                        >
                            Builder
                        </button>
                        <button
                            onClick={() => { generatePreview(); }}
                            className={`px-4 py-2 rounded-md transition-all ${activeTab === 'preview' ? 'bg-primary-500 text-white' : 'text-dark-muted hover:text-white'
                                }`}
                        >
                            Preview
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'build' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Column Selection */}
                    <div className="lg:col-span-2 glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Select Columns</h3>

                        <div className="space-y-6">
                            {['employee', 'payroll', 'attendance', 'statutory'].map((category) => (
                                <div key={category}>
                                    <h4 className="text-sm font-medium text-primary-400 uppercase tracking-wider mb-3">
                                        {category} Details
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {selectedColumns.filter(c => c.category === category).map((col) => (
                                            <div
                                                key={col.id}
                                                onClick={() => toggleColumn(col.id)}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${col.visible
                                                    ? 'bg-primary-500/10 border-primary-500/30'
                                                    : 'bg-dark-surface border-dark-border opacity-60'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <GripVertical className="w-4 h-4 text-dark-muted" />
                                                    <span className={col.visible ? 'text-white' : 'text-dark-muted'}>
                                                        {col.label}
                                                    </span>
                                                </div>
                                                {col.visible ? (
                                                    <Eye className="w-4 h-4 text-primary-400" />
                                                ) : (
                                                    <EyeOff className="w-4 h-4 text-dark-muted" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Report Settings */}
                    <div className="glass rounded-2xl p-6 h-fit sticky top-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Report Settings</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="text-dark-muted text-sm mb-1 block">Report Name</label>
                                <input
                                    type="text"
                                    value={reportName}
                                    onChange={(e) => setReportName(e.target.value)}
                                    placeholder="e.g. Monthly Salary Breakdown"
                                    className="w-full bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                                />
                            </div>

                            <div className="p-4 bg-dark-surface rounded-xl">
                                <div className="text-sm text-dark-muted mb-2">Summary</div>
                                <div className="flex justify-between text-white text-sm">
                                    <span>Selected Columns:</span>
                                    <span className="font-bold">{selectedColumns.filter(c => c.visible).length}</span>
                                </div>
                            </div>

                            <button
                                onClick={handleSaveTemplate}
                                disabled={!reportName}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                <Save className="w-5 h-5" />
                                Save Template
                            </button>
                        </div>

                        {/* Saved Templates List */}
                        <div className="mt-8">
                            <h4 className="text-sm font-medium text-white mb-3">Saved Templates</h4>
                            <div className="space-y-2">
                                {templates.length === 0 ? (
                                    <div className="text-sm text-dark-muted text-center py-4">No saved templates</div>
                                ) : (
                                    templates.map(t => (
                                        <div key={t.id} className="p-3 bg-dark-surface rounded-xl flex items-center justify-between">
                                            <span className="text-white text-sm truncate">{t.name}</span>
                                            <button className="text-primary-400 hover:text-primary-300 text-xs">Load</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="glass rounded-2xl overflow-hidden animate-slide-up">
                    <div className="p-6 border-b border-dark-border flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-white">Report Preview (First 5 Rows)</h3>
                        <button className="flex items-center gap-2 bg-primary-500/20 text-primary-400 px-4 py-2 rounded-lg hover:bg-primary-500/30 transition-all">
                            <Download className="w-4 h-4" />
                            Export Data
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-surface">
                                <tr>
                                    {selectedColumns.filter(c => c.visible).map(col => (
                                        <th key={col.id} className="text-left p-4 text-dark-muted font-medium whitespace-nowrap">
                                            {col.label}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-border">
                                {previewData.length === 0 ? (
                                    <tr>
                                        <td colSpan={selectedColumns.filter(c => c.visible).length} className="p-8 text-center text-dark-muted">
                                            No data available for preview
                                        </td>
                                    </tr>
                                ) : (
                                    previewData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-white/5 transition-all">
                                            {selectedColumns.filter(c => c.visible).map(col => (
                                                <td key={col.id} className="p-4 text-white whitespace-nowrap">
                                                    {row[col.label]}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
