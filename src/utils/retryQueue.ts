// Phase 24: Retry Queue for Network Failures

interface QueueItem {
    id: string;
    action: () => Promise<any>;
    retryCount: number;
    maxRetries: number;
    onSuccess?: (result: any) => void;
    onFailure?: (error: any) => void;
    createdAt: string;
}

export class RetryQueue {
    private queue: QueueItem[] = [];
    private isProcessing = false;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 2000; // 2 seconds

    /**
     * Add action to retry queue
     */
    addToQueue(
        action: () => Promise<any>,
        options?: {
            maxRetries?: number;
            onSuccess?: (result: any) => void;
            onFailure?: (error: any) => void;
        }
    ): string {
        const itemId = `retry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const item: QueueItem = {
            id: itemId,
            action,
            retryCount: 0,
            maxRetries: options?.maxRetries || this.MAX_RETRIES,
            onSuccess: options?.onSuccess,
            onFailure: options?.onFailure,
            createdAt: new Date().toISOString()
        };

        this.queue.push(item);
        this.processQueue();

        return itemId;
    }

    /**
     * Process queue
     */
    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.queue.length > 0) {
            const item = this.queue[0];

            try {
                const result = await item.action();

                // Success - remove from queue
                this.queue.shift();
                item.onSuccess?.(result);

            } catch (error) {
                item.retryCount++;

                if (item.retryCount >= item.maxRetries) {
                    // Max retries reached - remove and call failure callback
                    this.queue.shift();
                    item.onFailure?.(error);
                    console.error(`Failed after ${item.maxRetries} retries:`, error);
                } else {
                    // Wait before retry

                    await this.delay(this.RETRY_DELAY * item.retryCount); // Exponential backoff
                }
            }
        }

        this.isProcessing = false;
    }

    /**
     * Get queue status
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            isProcessing: this.isProcessing,
            items: this.queue.map(item => ({
                id: item.id,
                retryCount: item.retryCount,
                maxRetries: item.maxRetries,
                createdAt: item.createdAt
            }))
        };
    }

    /**
     * Clear queue
     */
    clearQueue() {
        this.queue = [];
        this.isProcessing = false;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Singleton instance
export const retryQueue = new RetryQueue();
