import { DollarSign, PieChart, TrendingUp, Download, Building } from 'lucide-react';

export const FinanceDashboard = () => {
    // Mock financial data
    const stats = [
        { label: 'Total Payroll Disbursed', value: '₹12,45,000', change: '+12%', icon: DollarSign, color: 'text-green-400', bg: 'bg-green-500/10' },
        { label: 'Pending Loans', value: '₹4,50,000', change: '-5%', icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
        { label: 'Statutory Dues (PF/ESI)', value: '₹85,200', change: '+2%', icon: Building, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        { label: 'Operating Expenses', value: '₹2,10,000', change: '+8%', icon: PieChart, color: 'text-purple-400', bg: 'bg-purple-500/10' }
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <DollarSign className="w-8 h-8 text-primary-500" />
                        Finance Overview
                    </h1>
                    <p className="text-dark-muted mt-1">Financial health tracking and accounting integration</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-dark-surface hover:bg-white/5 text-white rounded-xl transition-all">
                        Sync Tally
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl transition-all">
                        <Download className="w-4 h-4" />
                        Download P&L
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, i) => (
                    <div key={i} className="glass p-6 rounded-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${stat.change.startsWith('+') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                                }`}>
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-dark-muted text-sm font-medium">{stat.label}</h3>
                        <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Pending Payouts */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Pending Payouts</h3>
                    <div className="space-y-4">
                        {[
                            { item: 'Salary Batch #OCT-24', amount: '₹1,25,000', due: '31 Oct 2024', status: 'Processing' },
                            { item: 'Vendor Payment - Uniforms', amount: '₹45,000', due: '05 Nov 2024', status: 'Pending' },
                            { item: 'Electricity Bill', amount: '₹12,400', due: '10 Nov 2024', status: 'Scheduled' }
                        ].map((pay, i) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-dark-surface rounded-xl">
                                <div>
                                    <div className="text-white font-medium">{pay.item}</div>
                                    <div className="text-xs text-dark-muted">Due: {pay.due}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-white font-bold">{pay.amount}</div>
                                    <div className="text-xs text-yellow-500">{pay.status}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Journal Entries Preview */}
                <div className="glass rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Recent Journal Entries</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-dark-bg">
                                <tr>
                                    <th className="text-left p-3 text-dark-muted font-medium">Date</th>
                                    <th className="text-left p-3 text-dark-muted font-medium">Particulars</th>
                                    <th className="text-right p-3 text-dark-muted font-medium">Debit</th>
                                    <th className="text-right p-3 text-dark-muted font-medium">Credit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { date: '24 Oct', desc: 'Salary Account Dr.', debit: '12,45,000', credit: '-' },
                                    { date: '', desc: 'To Bank Account', debit: '-', credit: '12,45,000' },
                                    { date: '24 Oct', desc: 'PF Payable Cr.', debit: '-', credit: '45,000' }
                                ].map((entry, i) => (
                                    <tr key={i} className="border-b border-dark-border">
                                        <td className="p-3 text-dark-muted">{entry.date}</td>
                                        <td className="p-3 text-white">{entry.desc}</td>
                                        <td className="p-3 text-right text-white">{entry.debit}</td>
                                        <td className="p-3 text-right text-white">{entry.credit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <button className="w-full mt-4 text-center text-primary-400 text-sm hover:underline">
                        View All Entries
                    </button>
                </div>
            </div>
        </div>
    );
};
