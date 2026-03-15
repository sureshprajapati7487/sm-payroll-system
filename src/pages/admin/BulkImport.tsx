import { useState } from 'react';
import { Upload, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { BulkImporter } from '@/utils/bulkImporter';
import { useEmployeeStore } from '@/store/employeeStore';
import { useDialog } from '@/components/DialogProvider';
import { useDeviceType } from '@/hooks/useDeviceType';
import { Employee, EmployeeStatus, ShiftType, SalaryType } from '@/types';

export const BulkImport = () => {
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { addEmployee } = useEmployeeStore();
    const { toast } = useDialog();
    const { isDesktop } = useDeviceType();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setResult(null);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setIsProcessing(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            const text = e.target?.result as string;
            const importResult = await BulkImporter.importEmployees(text);
            setResult(importResult);
            setIsProcessing(false);
        };

        reader.readAsText(file);
    };

    const downloadTemplate = () => {
        const template = BulkImporter.generateEmployeeTemplate();
        const blob = new Blob([template], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_import_template.csv';
        a.click();
    };

    const handleApproveAndImport = async () => {
        if (!result || !result.preview.length) return;
        setIsSaving(true);
        try {
            let successCount = 0;
            for (const row of result.preview) {
                const newEmp: Omit<Employee, 'id'> = {
                    code: row.code,
                    name: row.name,
                    email: row.email || '',
                    phone: row.phone || '',
                    department: row.department || '',
                    designation: row.designation || '',
                    basicSalary: row.basicSalary || 0,
                    joiningDate: row.joiningDate || new Date().toISOString().split('T')[0],
                    status: 'ACTIVE' as EmployeeStatus,
                    role: 'EMPLOYEE',
                    shift: 'GENERAL' as ShiftType,
                    salaryType: SalaryType.MONTHLY,
                    isLeaveBlocked: false,
                    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${row.name}`,
                };
                await addEmployee(newEmp);
                successCount++;
            }
            toast(`Successfully imported ${successCount} employees!`, 'success');
            setResult(null);
            setFile(null);
        } catch (error) {
            toast('Failed to import employees', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isDesktop) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[500px] text-center px-4">
                <div className="w-20 h-20 bg-orange-500/10 flex items-center justify-center rounded-full mb-6 relative">
                    <Upload className="w-10 h-10 text-orange-500 opacity-50" />
                    <AlertTriangle className="w-6 h-6 text-orange-400 absolute bottom-4 right-4 bg-dark-bg rounded-full border border-dark-bg" />
                </div>
                <h2 className="text-2xl font-bold text-dark-text mb-3">Desktop Environment Required</h2>
                <p className="text-dark-muted max-w-sm leading-relaxed">
                    Bulk Data Import requires a <strong className="text-white">Desktop environment</strong> for processing complex CSV structures and mapping high-volume records reliably.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Upload className="w-8 h-8 text-primary-500" />
                    Bulk Import Employees
                </h1>
                <p className="text-dark-muted mt-1">Upload CSV file to import multiple employees at once</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Section */}
                <div className="space-y-6">
                    {/* Download Template */}
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-3">Step 1: Download Template</h3>
                        <p className="text-sm text-dark-muted mb-4">
                            Download the CSV template, fill it with employee data, and upload it below.
                        </p>
                        <button
                            onClick={downloadTemplate}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 rounded-xl transition-all"
                        >
                            <Download className="w-5 h-5" />
                            Download CSV Template
                        </button>
                    </div>

                    {/* File Upload */}
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-white mb-3">Step 2: Upload File</h3>

                        <div className="border-2 border-dashed border-dark-border rounded-xl p-8 text-center hover:border-primary-500 transition-colors">
                            <input
                                type="file"
                                accept=".csv"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label htmlFor="file-upload" className="cursor-pointer">
                                <Upload className="w-12 h-12 text-dark-muted mx-auto mb-3" />
                                <p className="text-white font-medium mb-1">
                                    {file ? file.name : 'Click to upload CSV file'}
                                </p>
                                <p className="text-sm text-dark-muted">
                                    or drag and drop
                                </p>
                            </label>
                        </div>

                        {file && (
                            <button
                                onClick={handleImport}
                                disabled={isProcessing}
                                className="w-full mt-4 bg-gradient-to-r from-primary-600 to-blue-600 hover:from-primary-500 hover:to-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {isProcessing ? 'Processing...' : 'Import Employees'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Results Section */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Import Results</h3>

                    {!result ? (
                        <div className="text-center py-12">
                            <Upload className="w-16 h-16 text-dark-muted mx-auto mb-4" />
                            <p className="text-dark-muted">
                                Upload a file to see import results
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-green-400 mb-2">
                                        <CheckCircle className="w-5 h-5" />
                                        <span className="text-sm font-semibold">Success</span>
                                    </div>
                                    <div className="text-3xl font-bold text-white">{result.success}</div>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-red-400 mb-2">
                                        <XCircle className="w-5 h-5" />
                                        <span className="text-sm font-semibold">Failed</span>
                                    </div>
                                    <div className="text-3xl font-bold text-white">{result.failed}</div>
                                </div>
                            </div>

                            {/* Errors */}
                            {result.errors.length > 0 && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-yellow-400 mb-3">
                                        <AlertTriangle className="w-5 h-5" />
                                        <span className="text-sm font-semibold">Errors ({result.errors.length})</span>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                        {result.errors.slice(0, 10).map((error: any, i: number) => (
                                            <div key={i} className="text-sm text-dark-muted">
                                                <span className="text-yellow-400">Row {error.row}:</span> {error.message}
                                            </div>
                                        ))}
                                        {result.errors.length > 10 && (
                                            <div className="text-sm text-dark-muted italic">
                                                ... and {result.errors.length - 10} more errors
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Preview */}
                            {result.preview.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-semibold text-white mb-2">Preview (First 5)</h4>
                                    <div className="bg-dark-surface rounded-xl overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-dark-bg">
                                                <tr>
                                                    <th className="text-left p-2 text-dark-muted font-medium">Code</th>
                                                    <th className="text-left p-2 text-dark-muted font-medium">Name</th>
                                                    <th className="text-left p-2 text-dark-muted font-medium">Salary</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {result.preview.slice(0, 5).map((emp: any, i: number) => (
                                                    <tr key={i} className="border-t border-dark-border">
                                                        <td className="p-2 text-white">{emp.code}</td>
                                                        <td className="p-2 text-white">{emp.name}</td>
                                                        <td className="p-2 text-white">₹{emp.basicSalary.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <button
                                        onClick={handleApproveAndImport}
                                        disabled={isSaving}
                                        className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        {isSaving ? 'Importing...' : `Approve & Import ${result.preview.length} Employees`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
