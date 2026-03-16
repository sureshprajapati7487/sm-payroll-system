import { useState } from 'react';
import { Building, DollarSign, TrendingUp, Save } from 'lucide-react';

interface CostCenter {
    id: string;
    name: string;
    code: string;
    department: string;
    budget: number;
    allocated: number;
}

export const CostCenterMapping = () => {
    const [costCenters, setCostCenters] = useState<CostCenter[]>([
        { id: '1', name: 'Production Operations', code: 'PROD-001', department: 'Production', budget: 500000, allocated: 450000 },
        { id: '2', name: 'Quality Assurance', code: 'QA-001', department: 'Quality', budget: 200000, allocated: 180000 },
        { id: '3', name: 'Sales & Marketing', code: 'SALES-001', department: 'Sales', budget: 350000, allocated: 320000 },
        { id: '4', name: 'Administration', code: 'ADMIN-001', department: 'Admin', budget: 300000, allocated: 280000 }
    ]);

    const [newCenter, setNewCenter] = useState({
        name: '',
        code: '',
        department: '',
        budget: 0
    });

    const [showAddForm, setShowAddForm] = useState(false);

    const addCostCenter = () => {
        if (!newCenter.name || !newCenter.code || !newCenter.department) return;

        const center: CostCenter = {
            id: Date.now().toString(),
            ...newCenter,
            allocated: 0
        };

        setCostCenters([...costCenters, center]);
        setNewCenter({ name: '', code: '', department: '', budget: 0 });
        setShowAddForm(false);
    };

    const totalBudget = costCenters.reduce((sum, c) => sum + c.budget, 0);
    const totalAllocated = costCenters.reduce((sum, c) => sum + c.allocated, 0);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Building className="w-8 h-8 text-primary-500" />
                        Cost Center Mapping
                    </h1>
                    <p className="text-dark-muted mt-1">Allocate salary expenses to cost centers and track budgets</p>
                </div>

                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                >
                    {showAddForm ? 'Cancel' : '+ Add Cost Center'}
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <DollarSign className="w-6 h-6 text-blue-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Total Budget</div>
                    <div className="text-3xl font-bold text-white mt-1">₹{totalBudget.toLocaleString()}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-green-500/20 rounded-xl">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Total Allocated</div>
                    <div className="text-3xl font-bold text-white mt-1">₹{totalAllocated.toLocaleString()}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-500/20 rounded-xl">
                            <DollarSign className="w-6 h-6 text-purple-400" />
                        </div>
                    </div>
                    <div className="text-dark-muted text-sm">Remaining Budget</div>
                    <div className="text-3xl font-bold text-white mt-1">₹{(totalBudget - totalAllocated).toLocaleString()}</div>
                </div>
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div className="glass rounded-2xl p-6 animate-slide-down">
                    <h3 className="text-lg font-semibold text-white mb-4">Add New Cost Center</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Cost Center Name"
                            value={newCenter.name}
                            onChange={(e) => setNewCenter({ ...newCenter, name: e.target.value })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        />
                        <input
                            type="text"
                            placeholder="Code (e.g., PROD-001)"
                            value={newCenter.code}
                            onChange={(e) => setNewCenter({ ...newCenter, code: e.target.value })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        />
                        <input
                            type="text"
                            placeholder="Department"
                            value={newCenter.department}
                            onChange={(e) => setNewCenter({ ...newCenter, department: e.target.value })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        />
                        <input
                            type="number"
                            placeholder="Budget Amount"
                            value={newCenter.budget || ''}
                            onChange={(e) => setNewCenter({ ...newCenter, budget: parseInt(e.target.value) || 0 })}
                            className="bg-dark-surface border border-dark-border rounded-xl px-4 py-3 text-white"
                        />
                    </div>
                    <button
                        onClick={addCostCenter}
                        className="mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                    >
                        <Save className="w-5 h-5" />
                        Save Cost Center
                    </button>
                </div>
            )}

            {/* Cost Centers Table */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-dark-border">
                    <h3 className="text-lg font-semibold text-white">Cost Centers</h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-dark-surface">
                            <tr>
                                <th className="text-left p-4 text-dark-muted font-medium">Code</th>
                                <th className="text-left p-4 text-dark-muted font-medium">Name</th>
                                <th className="text-left p-4 text-dark-muted font-medium">Department</th>
                                <th className="text-right p-4 text-dark-muted font-medium">Budget</th>
                                <th className="text-right p-4 text-dark-muted font-medium">Allocated</th>
                                <th className="text-right p-4 text-dark-muted font-medium">Utilization</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-border">
                            {costCenters.map((center) => {
                                const utilization = (center.allocated / center.budget) * 100;
                                return (
                                    <tr key={center.id} className="hover:bg-white/5 transition-all">
                                        <td className="p-4 text-white font-mono">{center.code}</td>
                                        <td className="p-4 text-white font-semibold">{center.name}</td>
                                        <td className="p-4 text-dark-muted">{center.department}</td>
                                        <td className="p-4 text-right text-white">₹{center.budget.toLocaleString()}</td>
                                        <td className="p-4 text-right text-white">₹{center.allocated.toLocaleString()}</td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center gap-2 justify-end">
                                                <div className="w-24 h-2 bg-dark-surface rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${utilization > 90 ? 'bg-red-500' :
                                                            utilization > 75 ? 'bg-yellow-500' :
                                                                'bg-green-500'
                                                            }`}
                                                        style={{ width: `${Math.min(utilization, 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-white text-sm">{utilization.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
