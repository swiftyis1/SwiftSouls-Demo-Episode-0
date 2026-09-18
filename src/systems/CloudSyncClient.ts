import { CryptoChecksum } from './CryptoChecksum.ts';
import type { SaveEnvelope } from './GameManager.ts';
import { ConflictResolver, type ConflictStrategy, type ConflictResolution } from './ConflictResolver.ts';

export type SyncStatus = 'IDLE' | 'SYNCING' | 'SYNCED' | 'OFFLINE' | 'CONFLICT' | 'ERROR';

export interface QueuedSyncItem {
    slot: number;
    envelope: SaveEnvelope;
    queuedAt: number;
}

export interface SyncResult {
    success: boolean;
    action: 'UPLOADED' | 'DOWNLOADED' | 'IN_SYNC' | 'QUEUED_OFFLINE' | 'ERROR';
    winner?: SaveEnvelope;
    resolution?: ConflictResolution;
    error?: string;
}

/**
 * CloudSyncClient: Offline-first remote save synchronization client.
 * Features 5MB payload protection, client throttling, cryptographic verification,
 * offline queueing with backoff, and progress-prioritized conflict resolution.
 */
export class CloudSyncClient {
    private static _instance: CloudSyncClient;

    public static get instance(): CloudSyncClient {
        if (!CloudSyncClient._instance) {
            CloudSyncClient._instance = new CloudSyncClient();
        }
        return CloudSyncClient._instance;
    }

    private status: SyncStatus = 'IDLE';
    private isOfflineMode: boolean = false;
    private restEndpoint: string | null = null;
    private listeners: ((status: SyncStatus, details?: string) => void)[] = [];
    private saveTimestamps: number[] = [];

    private readonly QUEUE_STORAGE_KEY = 'swiftsouls_sync_queue';
    private readonly CLOUD_STORAGE_PREFIX = 'swiftsouls_cloud_save_';
    private readonly MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5MB limit
    private readonly MAX_SAVES_PER_SEC = 3;

    constructor() {
        // Auto-detect browser online/offline events if available
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('online', () => {
                this.setStatus('IDLE', 'Network reconnected.');
                this.drainOfflineQueue();
            });
            window.addEventListener('offline', () => {
                this.setStatus('OFFLINE', 'Network connection lost.');
            });
        }
    }

    public onStatusChange(callback: (status: SyncStatus, details?: string) => void): () => void {
        this.listeners.push(callback);
        // Fire immediately with current state
        callback(this.status);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    public getStatus(): SyncStatus {
        return this.status;
    }

    private setStatus(status: SyncStatus, details?: string) {
        this.status = status;
        this.listeners.forEach(cb => {
            try {
                cb(status, details);
            } catch (e) {
                console.error('Error in CloudSyncClient status listener:', e);
            }
        });
    }

    public setOfflineMode(offline: boolean) {
        this.isOfflineMode = offline;
        if (offline) {
            this.setStatus('OFFLINE', 'Offline simulation active.');
        } else {
            this.setStatus('IDLE', 'Online mode restored.');
            this.drainOfflineQueue();
        }
    }

    public isOffline(): boolean {
        if (this.isOfflineMode) return true;
        if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
            return !navigator.onLine;
        }
        return false;
    }

    public setEndpoint(endpoint: string | null) {
        this.restEndpoint = endpoint;
    }

    /**
     * Enforces client throttling rate limit of max 3 saves per second.
     */
    private checkRateLimit(): boolean {
        const now = Date.now();
        this.saveTimestamps = this.saveTimestamps.filter(t => now - t < 1000);
        if (this.saveTimestamps.length >= this.MAX_SAVES_PER_SEC) {
            return false;
        }
        this.saveTimestamps.push(now);
        return true;
    }

    /**
     * Validates that payload does not exceed the 5MB security ceiling.
     */
    public validatePayloadSize(payload: string): boolean {
        return typeof payload === 'string' && payload.length <= this.MAX_PAYLOAD_BYTES;
    }

    /**
     * Uploads a save envelope to the remote/simulated cloud store.
     */
    public async uploadSave(slot: number, envelope: SaveEnvelope, isInternalDrain: boolean = false): Promise<SyncResult> {
        // Enforce 5MB limit
        if (!this.validatePayloadSize(envelope.payload)) {
            this.setStatus('ERROR', 'Save payload exceeds 5MB limit.');
            return { success: false, action: 'ERROR', error: 'Payload exceeds 5MB limit.' };
        }

        // Verify cryptographic signature before sending
        const isValid = CryptoChecksum.verifySignature(envelope.slot, envelope.timestamp, envelope.payload, envelope.signature);
        if (!isValid) {
            this.setStatus('ERROR', 'Cryptographic signature invalid. Upload rejected.');
            return { success: false, action: 'ERROR', error: 'Envelope signature is invalid.' };
        }

        // If offline, enqueue into local offline queue
        if (this.isOffline()) {
            this.enqueueOfflineSave(slot, envelope);
            this.setStatus('OFFLINE', `Saved locally. Slot ${slot} queued for sync.`);
            return { success: true, action: 'QUEUED_OFFLINE', winner: envelope };
        }

        // Enforce network rate limiting for active network requests
        if (!isInternalDrain && !this.checkRateLimit()) {
            this.setStatus('ERROR', 'Throttled: Exceeded 3 saves/second.');
            return { success: false, action: 'ERROR', error: 'Rate limit exceeded (max 3 saves/sec).' };
        }

        this.setStatus('SYNCING', `Uploading Slot ${slot}...`);

        try {
            if (this.restEndpoint) {
                // Production REST dispatch
                const res = await fetch(`${this.restEndpoint}/${slot}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(envelope)
                });
                if (!res.ok) {
                    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                }
            } else {
                // Default: Simulated isolated cloud storage
                localStorage.setItem(this.CLOUD_STORAGE_PREFIX + slot, JSON.stringify(envelope));
            }

            this.setStatus('SYNCED', `Slot ${slot} synced to cloud.`);
            return { success: true, action: 'UPLOADED', winner: envelope };
        } catch (e: any) {
            console.warn(`[CloudSync] Network dispatch failed for slot ${slot}. Enqueueing offline:`, e);
            this.enqueueOfflineSave(slot, envelope);
            this.setStatus('OFFLINE', `Network failure. Slot ${slot} queued.`);
            return { success: true, action: 'QUEUED_OFFLINE', winner: envelope };
        }
    }

    /**
     * Downloads a save envelope from the remote/simulated cloud store.
     */
    public async downloadSave(slot: number): Promise<SaveEnvelope | null> {
        if (this.isOffline()) {
            return null;
        }

        try {
            let rawData: string | null = null;
            if (this.restEndpoint) {
                const res = await fetch(`${this.restEndpoint}/${slot}`, { method: 'GET' });
                if (!res.ok) return null;
                rawData = await res.text();
            } else {
                rawData = localStorage.getItem(this.CLOUD_STORAGE_PREFIX + slot);
            }

            if (!rawData) return null;

            // Enforce 5MB limit on download
            if (!this.validatePayloadSize(rawData)) {
                console.error(`[CloudSync] Downloaded payload from slot ${slot} exceeds 5MB!`);
                return null;
            }

            const envelope: SaveEnvelope = JSON.parse(rawData);

            // Verify remote cryptographic signature
            if (!CryptoChecksum.verifySignature(envelope.slot, envelope.timestamp, envelope.payload, envelope.signature)) {
                console.error(`[CloudSync] Cryptographic integrity failure for cloud slot ${slot}! Signature mismatch.`);
                return null;
            }

            return envelope;
        } catch (e) {
            console.error(`[CloudSync] Failed to download cloud save for slot ${slot}:`, e);
            return null;
        }
    }

    /**
     * Performs full bidirectional synchronization for a specific slot,
     * applying the conflict resolution policy.
     */
    public async syncSlot(
        slot: number,
        localEnvelope: SaveEnvelope | null,
        strategy: ConflictStrategy = 'highest_progress'
    ): Promise<SyncResult> {
        if (this.isOffline()) {
            if (localEnvelope) {
                this.enqueueOfflineSave(slot, localEnvelope);
            }
            this.setStatus('OFFLINE', 'Offline. Sync queued.');
            return { success: true, action: 'QUEUED_OFFLINE', winner: localEnvelope || undefined };
        }

        this.setStatus('SYNCING', `Syncing Slot ${slot}...`);

        const cloudEnvelope = await this.downloadSave(slot);

        // Case 1: Neither exists
        if (!localEnvelope && !cloudEnvelope) {
            this.setStatus('SYNCED', `Slot ${slot} is empty.`);
            return { success: true, action: 'IN_SYNC' };
        }

        // Case 2: Only local exists -> upload to cloud
        if (localEnvelope && !cloudEnvelope) {
            return await this.uploadSave(slot, localEnvelope);
        }

        // Case 3: Only cloud exists -> download to local
        if (!localEnvelope && cloudEnvelope) {
            this.setStatus('SYNCED', `Slot ${slot} downloaded from cloud.`);
            return { success: true, action: 'DOWNLOADED', winner: cloudEnvelope };
        }

        // Case 4: Both exist -> invoke ConflictResolver
        const resolution = ConflictResolver.resolve(localEnvelope!, cloudEnvelope!, strategy);

        if (resolution.isIdentical) {
            this.setStatus('SYNCED', `Slot ${slot} is already in sync.`);
            return { success: true, action: 'IN_SYNC', winner: localEnvelope!, resolution };
        }

        if (resolution.winnerSource === 'local') {
            // Local wins: push to cloud
            const uploadRes = await this.uploadSave(slot, resolution.winner);
            this.setStatus('SYNCED', `Conflict resolved: Local won (${resolution.reason}).`);
            return {
                success: uploadRes.success,
                action: 'UPLOADED',
                winner: resolution.winner,
                resolution
            };
        } else {
            // Cloud wins: adopt cloud version
            this.setStatus('SYNCED', `Conflict resolved: Cloud won (${resolution.reason}).`);
            return {
                success: true,
                action: 'DOWNLOADED',
                winner: resolution.winner,
                resolution
            };
        }
    }

    /**
     * Offline Queue Management
     */
    private getOfflineQueue(): QueuedSyncItem[] {
        try {
            const raw = localStorage.getItem(this.QUEUE_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    private saveOfflineQueue(queue: QueuedSyncItem[]) {
        try {
            localStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.error('[CloudSync] Failed to persist offline queue:', e);
        }
    }

    public getPendingQueueCount(): number {
        return this.getOfflineQueue().length;
    }

    private enqueueOfflineSave(slot: number, envelope: SaveEnvelope) {
        const queue = this.getOfflineQueue().filter(item => item.slot !== slot);
        queue.push({
            slot,
            envelope,
            queuedAt: Date.now()
        });
        this.saveOfflineQueue(queue);
    }

    /**
     * Drains the offline queue by uploading queued items to the cloud.
     */
    public async drainOfflineQueue(): Promise<{ processed: number; errors: number }> {
        if (this.isOffline()) {
            return { processed: 0, errors: 0 };
        }

        const queue = this.getOfflineQueue();
        if (queue.length === 0) {
            return { processed: 0, errors: 0 };
        }

        this.setStatus('SYNCING', `Draining ${queue.length} queued saves...`);
        let processed = 0;
        let errors = 0;
        const remaining: QueuedSyncItem[] = [];

        for (const item of queue) {
            try {
                const res = await this.uploadSave(item.slot, item.envelope, true);
                if (res.success && res.action !== 'QUEUED_OFFLINE') {
                    processed++;
                } else {
                    remaining.push(item);
                    errors++;
                }
            } catch {
                remaining.push(item);
                errors++;
            }
        }

        this.saveOfflineQueue(remaining);

        if (remaining.length === 0) {
            this.setStatus('SYNCED', `Offline queue drained (${processed} uploaded).`);
        } else {
            this.setStatus('OFFLINE', `Queue partially drained (${processed} uploaded, ${remaining.length} pending).`);
        }

        return { processed, errors };
    }

    /**
     * Clears simulated cloud storage and offline queue.
     */
    public clearCloudStorage() {
        for (let i = 1; i <= 16; i++) {
            localStorage.removeItem(this.CLOUD_STORAGE_PREFIX + i);
        }
        localStorage.removeItem(this.QUEUE_STORAGE_KEY);
        this.setStatus('IDLE', 'Cloud storage cleared.');
    }
}
