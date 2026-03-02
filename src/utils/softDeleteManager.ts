// Phase 20: Soft Delete & Restore Utilities

interface SoftDeletable {
    id: string;
    isDeleted?: boolean;
    deletedAt?: string;
    deletedBy?: string;
}

export class SoftDeleteManager<T extends SoftDeletable> {
    private readonly TRASH_RETENTION_DAYS = 30;

    /**
     * Soft delete an item
     */
    softDelete(item: T, deletedBy: string): T {
        return {
            ...item,
            isDeleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy
        };
    }

    /**
     * Restore a deleted item
     */
    restore(item: T): T {
        const { isDeleted, deletedAt, deletedBy, ...rest } = item;
        return rest as T;
    }

    /**
     * Permanently delete items older than retention period
     */
    cleanupOldItems(items: T[]): T[] {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.TRASH_RETENTION_DAYS);
        const cutoffISO = cutoffDate.toISOString();

        return items.filter(item => {
            if (!item.isDeleted) return true; // Keep active items
            if (!item.deletedAt) return true; // Keep if no delete date
            return item.deletedAt > cutoffISO; // Keep if within retention period
        });
    }

    /**
     * Get items in trash
     */
    getTrashItems(items: T[]): T[] {
        return items.filter(item => item.isDeleted === true);
    }

    /**
     * Get active items only
     */
    getActiveItems(items: T[]): T[] {
        return items.filter(item => !item.isDeleted);
    }

    /**
     * Count items in trash
     */
    getTrashCount(items: T[]): number {
        return this.getTrashItems(items).length;
    }

    /**
     * Check if item can be permanently deleted
     */
    canPermanentlyDelete(item: T): boolean {
        if (!item.isDeleted || !item.deletedAt) return false;

        const deletedDate = new Date(item.deletedAt);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.TRASH_RETENTION_DAYS);

        return deletedDate <= cutoffDate;
    }

    /**
     * Get days until permanent deletion
     */
    getDaysUntilPermanentDelete(item: T): number {
        if (!item.deletedAt) return 0;

        const deletedDate = new Date(item.deletedAt);
        const expiryDate = new Date(deletedDate);
        expiryDate.setDate(expiryDate.getDate() + this.TRASH_RETENTION_DAYS);

        const now = new Date();
        const diffMs = expiryDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return Math.max(0, diffDays);
    }
}

// Singleton instance
export const softDeleteManager = new SoftDeleteManager();
