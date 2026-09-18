import { UserAuthManager, type UserProfile } from './UserAuthManager.ts';
import { LicenseManager, type LicenseTier } from './LicenseManager.ts';

export interface LiveOpsUserRecord {
    id: string;
    email: string;
    displayName: string;
    authProvider: string;
    verified: boolean;
    tier: LicenseTier;
    isAdmin: boolean;
    soulLevel: number;
    lastActiveAt: number;
}

export interface PremiumVaultRecord {
    email: string;
    tier: 'commercial';
    paymentRail: 'stripe' | 'telegram_stars' | 'admin_grant' | 'token';
    recoveryToken: string;
    grantedAt: number;
}

export interface BugReport {
    id: string;
    timestamp: number;
    playerEmail: string;
    mapId: string;
    coordinates: { x: number; y: number };
    soulLevel: number;
    equipment: { [slot: string]: string | null };
    description: string;
    thumbnailBase64?: string;
    status: 'unread' | 'investigating' | 'resolved';
    consoleErrors?: string[];
}

export interface BackupSnapshotMeta {
    key: string;
    dateStr: string;
    timestamp: number;
    sizeBytes: number;
}

export class LiveOpsManager {
    private static _instance: LiveOpsManager;

    public static get instance(): LiveOpsManager {
        if (!LiveOpsManager._instance) {
            LiveOpsManager._instance = new LiveOpsManager();
        }
        return LiveOpsManager._instance;
    }

    private static readonly USERS_KEY = 'swiftsouls_liveops_users';
    private static readonly VAULT_KEY = 'swiftsouls_premium_vault';
    private static readonly BUGS_KEY = 'swiftsouls_bug_reports';
    private static readonly LAST_BACKUP_TIME_KEY = 'swiftsouls_last_backup_time';
    private static readonly BACKUP_PREFIX = 'swiftsouls_backup_';
    private static readonly BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
    private static readonly RETENTION_DAYS = 30;
    private static readonly BUG_RATE_LIMIT_MS = 60 * 1000; // 60s per submission

    private lastBugReportTimestamp: number = 0;

    constructor() {
        this.initializeDefaultData();
    }

    private initializeDefaultData(): void {
        if (typeof localStorage === 'undefined') return;

        // Ensure current active user is registered in live-ops
        const profile = UserAuthManager.instance.getProfile();
        if (profile.email || profile.id) {
            this.recordUserActivity(profile, LicenseManager.instance.getTier(), 1);
        }
    }

    /**
     * Admin Authorization check:
     * - Returns true if active authenticated user is davidswift0920@gmail.com
     * - Returns true in localhost / dev mode environments
     */
    public isAuthorizedAdmin(): boolean {
        const profile = UserAuthManager.instance.getProfile();
        const email = (profile.email || '').trim().toLowerCase();

        if (UserAuthManager.ADMIN_EMAILS.some(e => e.toLowerCase() === email)) {
            return true;
        }

        // Localhost development mode
        if (typeof window !== 'undefined') {
            const host = window.location.hostname;
            if (host === 'localhost' || host === '127.0.0.1' || host.includes('dev')) {
                return true;
            }
        }

        return false;
    }

    // ==========================================
    // 1. USER & TIER REGISTRY
    // ==========================================

    public recordUserActivity(profile: UserProfile, tier: LicenseTier, soulLevel: number = 1): void {
        if (typeof localStorage === 'undefined') return;
        try {
            const users = this.getAllUsers();
            const userEmail = (profile.email || '').trim().toLowerCase();

            const existingIdx = users.findIndex(u => (u.email && u.email.toLowerCase() === userEmail) || u.id === profile.id);

            const record: LiveOpsUserRecord = {
                id: profile.id,
                email: profile.email || 'unlinked_guest',
                displayName: profile.displayName || 'Hero',
                authProvider: profile.authProvider,
                verified: profile.verified,
                tier,
                isAdmin: profile.isAdmin,
                soulLevel: Math.max(1, soulLevel),
                lastActiveAt: Date.now()
            };

            if (existingIdx >= 0) {
                users[existingIdx] = { ...users[existingIdx], ...record };
            } else {
                users.push(record);
            }

            localStorage.setItem(LiveOpsManager.USERS_KEY, JSON.stringify(users));
        } catch (e) {
            console.error('[LiveOpsManager] Error recording user activity:', e);
        }
    }

    public getAllUsers(): LiveOpsUserRecord[] {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(LiveOpsManager.USERS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    // ==========================================
    // 2. EMAIL-INDEXED PREMIUM VAULT
    // ==========================================

    public getPremiumVaultRecords(): PremiumVaultRecord[] {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(LiveOpsManager.VAULT_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Object.values(parsed);
        } catch {
            return [];
        }
    }

    public hasCommercialRecord(email: string): boolean {
        if (!email) return false;
        if (typeof localStorage === 'undefined') return false;
        try {
            const raw = localStorage.getItem(LiveOpsManager.VAULT_KEY);
            if (!raw) return false;
            const vault = JSON.parse(raw);
            return !!vault[email.trim().toLowerCase()];
        } catch {
            return false;
        }
    }

    public grantCommercialByAdmin(email: string): { success: boolean; recoveryToken: string; message: string } {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@')) {
            return { success: false, recoveryToken: '', message: 'Invalid email address.' };
        }

        const recoveryToken = LicenseManager.instance.generateRecoveryToken();
        const record: PremiumVaultRecord = {
            email: cleanEmail,
            tier: 'commercial',
            paymentRail: 'admin_grant',
            recoveryToken,
            grantedAt: Date.now()
        };

        try {
            let vault: { [email: string]: PremiumVaultRecord } = {};
            const raw = localStorage.getItem(LiveOpsManager.VAULT_KEY);
            if (raw) vault = JSON.parse(raw) || {};
            vault[cleanEmail] = record;
            localStorage.setItem(LiveOpsManager.VAULT_KEY, JSON.stringify(vault));

            // If active user is this email, immediately upgrade active session
            const currentProfile = UserAuthManager.instance.getProfile();
            if (currentProfile.email && currentProfile.email.toLowerCase() === cleanEmail) {
                LicenseManager.instance.upgradeToCommercial({
                    paymentRail: 'admin_grant',
                    recoveryToken,
                    bondedEmail: cleanEmail
                });
            }

            return {
                success: true,
                recoveryToken,
                message: `Commercial license granted to ${cleanEmail}. Token: ${recoveryToken}`
            };
        } catch (e) {
            return { success: false, recoveryToken: '', message: 'Failed to update vault: ' + String(e) };
        }
    }

    public revokeCommercialByAdmin(email: string): { success: boolean; message: string } {
        const cleanEmail = email.trim().toLowerCase();
        try {
            let vault: { [email: string]: PremiumVaultRecord } = {};
            const raw = localStorage.getItem(LiveOpsManager.VAULT_KEY);
            if (raw) vault = JSON.parse(raw) || {};

            if (!vault[cleanEmail]) {
                return { success: false, message: 'Email not found in Premium Vault.' };
            }

            delete vault[cleanEmail];
            localStorage.setItem(LiveOpsManager.VAULT_KEY, JSON.stringify(vault));

            // If active user is this email, revoke active session
            const currentProfile = UserAuthManager.instance.getProfile();
            if (currentProfile.email && currentProfile.email.toLowerCase() === cleanEmail) {
                LicenseManager.instance.revokeCommercial();
            }

            return { success: true, message: `Commercial license revoked for ${cleanEmail}.` };
        } catch (e) {
            return { success: false, message: 'Failed to revoke: ' + String(e) };
        }
    }

    // ==========================================
    // 3. SPECIES EXTINCTION TELEMETRY
    // ==========================================

    public getExtinctionTelemetry(): {
        [speciesId: string]: { totalKills: number; isExtinct: boolean; name: string };
    } {
        const result: { [speciesId: string]: { totalKills: number; isExtinct: boolean; name: string } } = {
            keenkat: { totalKills: 0, isExtinct: false, name: 'Verdant Kit' },
            goblin: { totalKills: 0, isExtinct: false, name: 'Goblin' },
            snake: { totalKills: 0, isExtinct: false, name: 'Heal Snake' },
            slime: { totalKills: 0, isExtinct: false, name: 'Acid Slime' },
            bat: { totalKills: 0, isExtinct: false, name: 'Vampire Bat' },
            skeleton: { totalKills: 0, isExtinct: false, name: 'Skeleton Archer' },
            phoenix: { totalKills: 0, isExtinct: false, name: 'Phoenix' }
        };

        if (typeof localStorage === 'undefined') return result;

        // Inspect primary save slots to aggregate telemetry
        for (let i = 1; i <= 3; i++) {
            const raw = localStorage.getItem('swiftsouls_save_' + i);
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    let state: any = null;
                    if (parsed.version === 2 && parsed.payload) {
                        state = JSON.parse(parsed.payload);
                    } else if (parsed.soulCrystals) {
                        state = parsed;
                    }

                    if (state && state.soulCrystals) {
                        for (const key in result) {
                            if (state.soulCrystals[key]) {
                                const frag = state.soulCrystals[key].fragments || 0;
                                result[key].totalKills = Math.max(result[key].totalKills, frag);
                                if (state.soulCrystals[key].isExtinct || frag >= 255) {
                                    result[key].isExtinct = true;
                                }
                            }
                        }
                    }
                } catch {}
            }
        }

        return result;
    }

    // ==========================================
    // 4. HIGH-FIDELITY BUG REPORTING ENGINE
    // ==========================================

    public submitBugReport(report: {
        playerEmail?: string;
        mapId: string;
        coordinates: { x: number; y: number };
        soulLevel: number;
        equipment: { [slot: string]: string | null };
        description: string;
        thumbnailBase64?: string;
        consoleErrors?: string[];
    }): { success: boolean; message: string; reportId?: string } {
        const now = Date.now();
        if (now - this.lastBugReportTimestamp < LiveOpsManager.BUG_RATE_LIMIT_MS) {
            const remaining = Math.ceil((LiveOpsManager.BUG_RATE_LIMIT_MS - (now - this.lastBugReportTimestamp)) / 1000);
            return {
                success: false,
                message: `Please wait ${remaining}s before submitting another bug report.`
            };
        }

        if (!report.description || report.description.trim().length < 5) {
            return { success: false, message: 'Please provide a descriptive explanation (at least 5 chars).' };
        }

        const id = 'BUG-' + now.toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 1000);
        const profile = UserAuthManager.instance.getProfile();

        const newReport: BugReport = {
            id,
            timestamp: now,
            playerEmail: report.playerEmail || profile.email || 'Anonymous',
            mapId: report.mapId,
            coordinates: report.coordinates,
            soulLevel: report.soulLevel,
            equipment: report.equipment,
            description: report.description.trim(),
            thumbnailBase64: report.thumbnailBase64,
            status: 'unread',
            consoleErrors: report.consoleErrors || []
        };

        const existing = this.getBugReports();
        existing.unshift(newReport);

        // Keep maximum 50 bug reports locally to avoid storage quota overflow
        if (existing.length > 50) {
            existing.pop();
        }

        try {
            localStorage.setItem(LiveOpsManager.BUGS_KEY, JSON.stringify(existing));
            this.lastBugReportTimestamp = now;
            return { success: true, message: 'Thank you! Your feedback has been recorded for the dev team.', reportId: id };
        } catch (e) {
            return { success: false, message: 'Failed to record feedback: ' + String(e) };
        }
    }

    public getBugReports(): BugReport[] {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(LiveOpsManager.BUGS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    public getUnreadBugCount(): number {
        return this.getBugReports().filter(r => r.status === 'unread').length;
    }

    public updateBugStatus(id: string, status: BugReport['status']): boolean {
        const reports = this.getBugReports();
        const item = reports.find(r => r.id === id);
        if (item) {
            item.status = status;
            try {
                localStorage.setItem(LiveOpsManager.BUGS_KEY, JSON.stringify(reports));
                return true;
            } catch {}
        }
        return false;
    }

    // ==========================================
    // 5. 24-HOUR AUTOMATED ROLLING BACKUP ENGINE
    // ==========================================

    public checkAndRunDailyBackup(): boolean {
        if (typeof localStorage === 'undefined') return false;
        const now = Date.now();
        const lastBackupStr = localStorage.getItem(LiveOpsManager.LAST_BACKUP_TIME_KEY);
        const lastBackupTime = lastBackupStr ? parseInt(lastBackupStr, 10) : 0;

        if (now - lastBackupTime >= LiveOpsManager.BACKUP_INTERVAL_MS) {
            return this.createDailyBackupSnapshot(now);
        }
        return false;
    }

    public createDailyBackupSnapshot(timestamp: number = Date.now()): boolean {
        if (typeof localStorage === 'undefined') return false;

        const date = new Date(timestamp);
        const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
        const backupKey = LiveOpsManager.BACKUP_PREFIX + dateStr;

        const bundle = this.generateDisasterRecoveryBundle();
        try {
            localStorage.setItem(backupKey, bundle);
            localStorage.setItem(LiveOpsManager.LAST_BACKUP_TIME_KEY, timestamp.toString());
            this.pruneOldBackups();
            console.log(`[LiveOpsManager] 📦 Automated daily backup snapshot created: ${backupKey}`);
            return true;
        } catch (e) {
            console.error('[LiveOpsManager] Failed to create daily backup:', e);
            return false;
        }
    }

    public getBackupsList(): BackupSnapshotMeta[] {
        if (typeof localStorage === 'undefined') return [];
        const result: BackupSnapshotMeta[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(LiveOpsManager.BACKUP_PREFIX)) {
                const dateStr = key.replace(LiveOpsManager.BACKUP_PREFIX, '');
                const val = localStorage.getItem(key) || '';
                result.push({
                    key,
                    dateStr,
                    timestamp: new Date(dateStr).getTime() || Date.now(),
                    sizeBytes: val.length
                });
            }
        }

        return result.sort((a, b) => b.timestamp - a.timestamp);
    }

    private pruneOldBackups(): void {
        const backups = this.getBackupsList();
        if (backups.length > LiveOpsManager.RETENTION_DAYS) {
            const toDelete = backups.slice(LiveOpsManager.RETENTION_DAYS);
            toDelete.forEach(b => {
                localStorage.removeItem(b.key);
                console.log(`[LiveOpsManager] 🗑️ Pruned old backup snapshot: ${b.key}`);
            });
        }
    }

    public restoreFromBackup(backupKey: string): boolean {
        if (typeof localStorage === 'undefined') return false;
        const bundle = localStorage.getItem(backupKey);
        if (!bundle) return false;
        const res = this.restoreDisasterRecoveryBundle(bundle);
        return res.success;
    }

    // ==========================================
    // 6. OFFSITE DISASTER RECOVERY BUNDLE
    // ==========================================

    public generateDisasterRecoveryBundle(): string {
        if (typeof localStorage === 'undefined') return '{}';

        const exportData: { [key: string]: any } = {
            exportVersion: 2,
            exportedAt: Date.now(),
            system: 'Project SwiftSouls Live-Ops & Cloud Save Vault',
            items: {}
        };

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('swiftsouls_') && !key.startsWith(LiveOpsManager.BACKUP_PREFIX))) {
                exportData.items[key] = localStorage.getItem(key);
            }
        }

        return JSON.stringify(exportData, null, 2);
    }

    public restoreDisasterRecoveryBundle(jsonString: string): { success: boolean; message: string } {
        if (typeof localStorage === 'undefined') return { success: false, message: 'No localStorage available.' };

        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed || !parsed.items || typeof parsed.items !== 'object') {
                return { success: false, message: 'Invalid backup bundle format.' };
            }

            let restoredCount = 0;
            for (const key in parsed.items) {
                if (key.startsWith('swiftsouls_')) {
                    localStorage.setItem(key, parsed.items[key]);
                    restoredCount++;
                }
            }

            return {
                success: true,
                message: `Successfully restored ${restoredCount} database tables and save slots.`
            };
        } catch (e) {
            return { success: false, message: 'Corrupted backup bundle: ' + String(e) };
        }
    }

    // ==========================================
    // 7. CSV DATA EXPORT GENERATORS
    // ==========================================

    public getUsersCSV(): string {
        const users = this.getAllUsers();
        const headers = ['Email', 'Display Name', 'Auth Provider', 'Verified', 'License Tier', 'Admin', 'Soul Level', 'Last Active'];
        const rows = users.map(u => [
            `"${u.email}"`,
            `"${u.displayName}"`,
            `"${u.authProvider}"`,
            u.verified ? 'YES' : 'NO',
            `"${u.tier.toUpperCase()}"`,
            u.isAdmin ? 'YES' : 'NO',
            u.soulLevel,
            `"${new Date(u.lastActiveAt).toISOString()}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    public getBugReportsCSV(): string {
        const bugs = this.getBugReports();
        const headers = ['ID', 'Date', 'Email', 'Map ID', 'X', 'Y', 'Soul Level', 'Status', 'Description'];
        const rows = bugs.map(b => [
            `"${b.id}"`,
            `"${new Date(b.timestamp).toISOString()}"`,
            `"${b.playerEmail}"`,
            `"${b.mapId}"`,
            b.coordinates.x,
            b.coordinates.y,
            b.soulLevel,
            `"${b.status.toUpperCase()}"`,
            `"${b.description.replace(/"/g, '""')}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    public getPremiumVaultCSV(): string {
        const records = this.getPremiumVaultRecords();
        const headers = ['Email', 'License Tier', 'Payment Rail', 'Recovery Token', 'Granted Date'];
        const rows = records.map(r => [
            `"${r.email}"`,
            `"${r.tier.toUpperCase()}"`,
            `"${r.paymentRail}"`,
            `"${r.recoveryToken}"`,
            `"${new Date(r.grantedAt).toISOString()}"`
        ]);

        return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }
}
