import { useState } from 'react';
import { Save, Trash2, Upload, RefreshCw, Clock, Check } from 'lucide-react';
import { useDraftStore } from '@/store/draftStore';

export const DraftManager = () => {
    const { drafts, deleteDraft, autoSaveEnabled, toggleAutoSave, markSynced, lastSyncTime } = useDraftStore();
    const [selectedType, setSelectedType] = useState<string>('all');

    const filteredDrafts = selectedType === 'all'
        ? drafts
        : drafts.filter(d => d.type === selectedType);

    const handleSync = (draftId: string) => {
        // Simulate sync
        setTimeout(() => {
            markSynced(draftId);
        }, 1000);
    };

    const getSyncStatusColor = (status: string) => {
        switch (status) {
            case 'synced': return 'text-green-400';
            case 'pending': return 'text-yellow-400';
            case 'offline': return 'text-red-400';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Save className="w-8 h-8 text-primary-500" />
                        Draft Manager
                    </h1>
                    <p className="text-dark-muted mt-1">Manage auto-saved drafts and resume incomplete work</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleAutoSave}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${autoSaveEnabled
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Auto-save: {autoSaveEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Total Drafts</div>
                    <div className="text-3xl font-bold text-white mt-1">{drafts.length}</div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Pending Sync</div>
                    <div className="text-3xl font-bold text-yellow-400 mt-1">
                        {drafts.filter(d => d.syncStatus === 'pending').length}
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Synced</div>
                    <div className="text-3xl font-bold text-green-400 mt-1">
                        {drafts.filter(d => d.syncStatus === 'synced').length}
                    </div>
                </div>

                <div className="glass rounded-2xl p-6">
                    <div className="text-dark-muted text-sm">Last Sync</div>
                    <div className="text-sm font-bold text-white mt-1">
                        {lastSyncTime ? new Date(lastSyncTime).toLocaleTimeString() : 'Never'}
                    </div>
                </div>
            </div>

            {/* Filter */}
            <div className="glass rounded-2xl p-4">
                <div className="flex gap-3 flex-wrap">
                    {['all', 'payroll', 'attendance', 'employee', 'loan'].map(type => (
                        <button
                            key={type}
                            onClick={() => setSelectedType(type)}
                            className={`px-4 py-2 rounded-lg transition-all ${selectedType === type
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-dark-surface text-dark-muted hover:bg-white/5'
                                }`}
                        >
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Drafts List */}
            <div className="glass rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-dark-border">
                    <h3 className="text-lg font-semibold text-white">Saved Drafts</h3>
                </div>

                {filteredDrafts.length === 0 ? (
                    <div className="p-12 text-center text-dark-muted">
                        <Save className="w-16 h-16 mx-auto mb-4 opacity-20" />
                        <div className="text-lg">No drafts found</div>
                        <div className="text-sm mt-2">Your auto-saved work will appear here</div>
                    </div>
                ) : (
                    <div className="divide-y divide-dark-border">
                        {filteredDrafts.map((draft) => (
                            <div key={draft.id} className="p-6 hover:bg-white/5 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="text-white font-semibold">{draft.title}</h4>
                                            <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                                                {draft.type}
                                            </span>
                                            {draft.autoSaved && (
                                                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">
                                                    Auto-saved
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-3">
                                            <div className="text-sm">
                                                <span className="text-dark-muted">Created: </span>
                                                <span className="text-white">
                                                    {new Date(draft.createdAt).toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="text-dark-muted">Last Updated: </span>
                                                <span className="text-white">
                                                    {new Date(draft.updatedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <div className={`flex items-center gap-2 text-sm ${getSyncStatusColor(draft.syncStatus)}`}>
                                                {draft.syncStatus === 'synced' && <Check className="w-4 h-4" />}
                                                {draft.syncStatus === 'pending' && <Clock className="w-4 h-4 animate-pulse" />}
                                                <span>{draft.syncStatus.toUpperCase()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {draft.syncStatus === 'pending' && (
                                            <button
                                                onClick={() => handleSync(draft.id)}
                                                className="flex items-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-2 rounded-xl transition-all"
                                            >
                                                <Upload className="w-4 h-4" />
                                                Sync
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteDraft(draft.id)}
                                            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {autoSaveEnabled && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                    <div className="text-green-400 font-semibold text-sm mb-1">Auto-save Active</div>
                    <div className="text-dark-muted text-xs">
                        Your work is being automatically saved every 2 seconds. Don't worry about losing progress!
                    </div>
                </div>
            )}
        </div>
    );
};
