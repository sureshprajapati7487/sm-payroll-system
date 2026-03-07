import { useState } from 'react';
import { FileBarChart, Save, Download, GripVertical, Eye, EyeOff } from 'lucide-react';
import { useCustomReportStore, ReportColumn } from '@/store/customReportStore';
import { apiJson, apiFetch } from '@/lib/apiClient';
import { useDialog } from '@/components/DialogProvider';

export const CustomReportBuilder = () => {
    const { availableColumns, saveTemplate, templates } = useCustomReportStore();
    const { toast } = useDialog();

    // State for builder
    const [reportName, setReportName] = useState('');
    const [selectedColumns, setSelectedColumns] = useState<ReportColumn[]>(availableColumns);
    const [activeTab, setActiveTab] = useState<'build' | 'preview'>('build');
    const [previewData, setPreviewData] = useState<any[]>([]);

    const [isExporting, setIsExporting] = useState(false);

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

        toast('Report template successfully save ho gaya!', 'success');
        setReportName('');
    };

    const generatePreview = async () => {
        const visibleCols = selectedColumns.filter(c => c.visible);
        try {
            const res = await apiJson<{ data: string[][] }>('POST', '/reports/generate', {
                columns: visibleCols,
                format: 'preview'
            });

            if (res.data && res.data.length > 0) {
                const headers = res.data[0];
                const rows = res.data.slice(1).map(rowArray => {
                    const rowObj: Record<string, string> = {};
                    headers.forEach((h, i) => rowObj[h] = rowArray[i]);
                    return rowObj;
                });
                setPreviewData(rows);
            } else {
                setPreviewData([]);
            }
            setActiveTab('preview');
        } catch (error) {
            toast('Failed to generate preview from server', 'error');
        }
    };

    const pollJobStatus = async (jobId: string) => {
        const pollInterval = setInterval(async () => {
            try {
                const res = await apiFetch(`/reports/jobs/${jobId}`);
                if (res.ok) {
                    const job = await res.json();
                    if (job.status === 'COMPLETED') {
                        clearInterval(pollInterval);
                        setIsExporting(false);

                        // Download the actual file via authenticated fetch
                        const fileRes = await apiFetch(job.downloadUrl);
                        const blob = await fileRes.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${reportName || 'Custom_Report'}_${new Date().toISOString().split('T')[0]}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);

                        toast('Report downloaded successfully!', 'success');
                    } else if (job.status === 'FAILED') {
                        clearInterval(pollInterval);
                        setIsExporting(false);
                        toast(`Report generation failed: ${job.error || 'Unknown error'}`, 'error');
                    }
                }
            } catch (e) {
                clearInterval(pollInterval);
                setIsExporting(false);
                toast('Network error while checking report status', 'error');
            }
        }, 2000);
    };

    const exportToCSV = async () => {
        const visibleCols = selectedColumns.filter(c => c.visible);
        setIsExporting(true);
        try {
            const response = await apiFetch('/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    columns: visibleCols,
                    format: 'csv'
                })
            });

            if (!response.ok) throw new Error('Export failed');

            const data = await response.json();
            if (data.jobId) {
                toast('Report generation started in background...', 'success');
                pollJobStatus(data.jobId);
            } else {
                setIsExporting(false);
                toast('Failed to start report generation', 'error');
            }
        } catch (error) {
            setIsExporting(false);
            toast('Failed to request report', 'error');
        }
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
                        <button
                            onClick={exportToCSV}
                            disabled={isExporting}
                            className="flex items-center gap-2 bg-primary-500/20 text-primary-400 px-4 py-2 rounded-lg hover:bg-primary-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" />
                            {isExporting ? 'Generating...' : 'Export Data'}
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
