import { useState } from 'react';
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

interface TrashItem {
    id: string;
    type: 'EMPLOYEE' | 'LOAN' | 'PAYROLL' | 'ATTENDANCE';
    name: string;
    deletedAt: string;
    deletedBy: string;
    isDeleted: boolean;
}

export const TrashManagement = () => {
    const [activeTab, setActiveTab] = useState<'EMPLOYEE' | 'LOAN' | 'PAYROLL' | 'ATTENDANCE'>('EMPLOYEE');
    const [items, setItems] = useState<TrashItem[]>([
        // Demo data - in real app, fetch from stores
        {
            id: '1',
            type: 'EMPLOYEE',
            name: 'John Doe',
            deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            deletedBy: 'admin',
            isDeleted: true
        }
    ]);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, step: number } | null>(null);

    const filteredItems = items.filter(item => item.type === activeTab && item.isDeleted);

    const handleRestore = (id: string) => {
        setItems(items.map(item =>
            item.id === id ? { ...item, isDeleted: false } : item
        ));
        alert('Item restored successfully!');
    };

    const handlePermanentDelete = (id: string) => {
        if (deleteConfirm?.id === id && deleteConfirm.step === 3) {
            setItems(items.filter(item => item.id !== id));
            setDeleteConfirm(null);
            alert('Item permanently deleted!');
        } else if (deleteConfirm?.id === id) {
            setDeleteConfirm({ id, step: deleteConfirm.step + 1 });
        } else {
            setDeleteConfirm({ id, step: 1 });
        }
    };

    const getDaysRemaining = (deletedAt: string) => {
        const deleted = new Date(deletedAt);
        const expiry = new Date(deleted.getTime() + 30 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diffMs = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        return Math.max(0, diffDays);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Trash2 className="w-8 h-8 text-danger" />
                    Trash Management
                </h1>
                <p className="text-dark-muted mt-1">Restore or permanently delete items (30-day retention)</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {(['EMPLOYEE', 'LOAN', 'PAYROLL', 'ATTENDANCE'] as const).map(type => {
                    const count = items.filter(i => i.type === type && i.isDeleted).length;
                    return (
                        <div key={type} className="glass rounded-xl p-4">
                            <div className="text-dark-muted text-sm">{type.toLowerCase()}s</div>
                            <div className="text-2xl font-bold text-white">{count}</div>
                        </div>
                    );
                })}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-dark-border">
                {(['EMPLOYEE', 'LOAN', 'PAYROLL', 'ATTENDANCE'] as const).map(type => (
                    <button
                        key={type}
                        onClick={() => setActiveTab(type)}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === type
                            ? 'text-primary-400 border-b-2 border-primary-500'
                            : 'text-dark-muted hover:text-white'
                            }`}
                    >
                        {type}S
                    </button>
                ))}
            </div>

            {/* Items List */}
            <div className="glass rounded-2xl overflow-hidden">
                {filteredItems.length === 0 ? (
                    <div className="text-center py-12 text-dark-muted">
                        <Trash2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                        <p>No deleted {activeTab.toLowerCase()}s in trash</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-bg border-b border-dark-border">
                                <tr>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">Name</th>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">Deleted</th>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">By</th>
                                    <th className="text-left p-4 text-dark-muted text-sm font-medium">Days Left</th>
                                    <th className="text-right p-4 text-dark-muted text-sm font-medium">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item) => {
                                    const daysLeft = getDaysRemaining(item.deletedAt);
                                    const isConfirming = deleteConfirm?.id === item.id;

                                    return (
                                        <tr key={item.id} className="border-b border-dark-border hover:bg-white/5">
                                            <td className="p-4 text-white">{item.name}</td>
                                            <td className="p-4 text-dark-muted text-sm">
                                                {new Date(item.deletedAt).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-dark-muted text-sm">{item.deletedBy}</td>
                                            <td className="p-4">
                                                <span className={`text-sm px-2 py-1 rounded ${daysLeft <= 7
                                                    ? 'bg-red-500/20 text-red-400'
                                                    : daysLeft <= 14
                                                        ? 'bg-yellow-500/20 text-yellow-400'
                                                        : 'bg-green-500/20 text-green-400'
                                                    }`}>
                                                    {daysLeft} days
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => handleRestore(item.id)}
                                                        className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm transition-all"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                        Restore
                                                    </button>

                                                    <button
                                                        onClick={() => handlePermanentDelete(item.id)}
                                                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all ${isConfirming
                                                            ? 'bg-red-500 text-white'
                                                            : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                                                            }`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                        {isConfirming
                                                            ? `Click ${4 - deleteConfirm.step} more time${deleteConfirm.step < 3 ? 's' : ''}`
                                                            : 'Delete Forever'
                                                        }
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Warning */}
            <div className="glass rounded-xl p-4 border-l-4 border-yellow-500">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div>
                        <div className="text-yellow-400 font-semibold text-sm">Important</div>
                        <div className="text-dark-muted text-sm mt-1">
                            Items are automatically deleted after 30 days. Permanent deletion cannot be undone.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
