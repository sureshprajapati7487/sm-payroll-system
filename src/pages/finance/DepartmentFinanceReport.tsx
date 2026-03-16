import { useState } from 'react';
import { TrendingUp, DollarSign, FileText, Download } from 'lucide-react';

interface DepartmentSalaryData {
    department: string;
    totalSalary: number;
    employeeCount: number;
    avgSalary: number;
}

export const DepartmentFinanceReport = () => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Mock data - in production, fetch from backend
    const departmentData: DepartmentSalaryData[] = [
        { department: 'Production', totalSalary: 450000, employeeCount: 15, avgSalary: 30000 },
        { department: 'Admin', totalSalary: 280000, employeeCount: 8, avgSalary: 35000 },
        { department: 'Sales', totalSalary: 320000, employeeCount: 10, avgSalary: 32000 },
        { department: 'Quality', totalSalary: 180000, employeeCount: 6, avgSalary: 30000 },
        { department: 'Maintenance', totalSalary: 120000, employeeCount: 4, avgSalary: 30000 }
    ];

    const totalSalary = departmentData.reduce((sum, d) => sum + d.totalSalary, 0);

    const exportReport = () => {
        // Generate CSV
        const csv = [
            ['Department', 'Employees', 'Total Salary', 'Average Salary'].join(','),
            ...departmentData.map(d =>
                [d.department, d.employeeCount, d.totalSalary, d.avgSalary].join(',')
            )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `department-finance-${selectedMonth}.csv`;
        a.click();
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <TrendingUp className="w-8 h-8 text-primary-500" />
                        Department Finance Report
                    </h1>
                    <p className="text-dark-muted mt-1">Department-wise salary allocation and budgeting</p>
                </div>

                <button
                    onClick={exportReport}
                    className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl transition-all"
                >
                    <Download className="w-5 h-5" />
                    Export CSV
                </button>
            </div>

            {/* Month Selector */}
            <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-4">
                <FileText className="w-5 h-5 text-primary-400" />
                <label className="text-white font-medium">Select Month:</label>
                <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-dark-surface border border-dark-border rounded-lg px-4 py-2 text-white"
                />
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-primary-500/20 rounded-xl">
                            <DollarSign className="w-6 h-6 text-primary-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Total Salary Distribution</div>
                    <div className="text-3xl font-bold text-white mt-1">₹{totalSalary.toLocaleString()}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-green-500/20 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Departments</div>
                    <div className="text-3xl font-bold text-white mt-1">{departmentData.length}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <DollarSign className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Average Department Cost</div>
                    <div className="text-3xl font-bold text-white mt-1">
                        ₹{Math.round(totalSalary / departmentData.length).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* Department Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-dark-border">
                    <h3 className="text-lg font-semibold text-white">Department-wise Breakdown</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="text-left p-4 text-dark-muted font-medium">Department</th>
                                <th className="text-right p-4 text-dark-muted font-medium">Employees</th>
                                <th className="text-right p-4 text-dark-muted font-medium">Total Salary</th>
                                <th className="text-right p-4 text-dark-muted font-medium">Avg Salary</th>
                                <th className="text-right p-4 text-dark-muted font-medium">% of Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {departmentData.map((dept, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-all">
                                    <td className="p-4 text-white font-semibold">{dept.department}</td>
                                    <td className="p-4 text-right text-white">{dept.employeeCount}</td>
                                    <td className="p-4 text-right text-white font-semibold">
                                        ₹{dept.totalSalary.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right text-dark-muted">
                                        ₹{dept.avgSalary.toLocaleString()}
                                    </td>
                                    <td className="p-4 text-right">
                                        <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm">
                                            {((dept.totalSalary / totalSalary) * 100).toFixed(1)}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
