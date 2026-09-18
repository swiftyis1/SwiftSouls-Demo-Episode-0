import { UserAuthManager } from './UserAuthManager.ts';

export type LicenseTier = 'evaluation' | 'commercial';

export interface LicenseRecord {
    tier: LicenseTier;
    activePlaytimeSeconds: number;
    purchasedAt?: number;
    bondedEmail?: string;
    recoveryToken?: string;
    paymentRail?: 'stripe' | 'telegram_stars' | 'admin_grant' | 'token';
}

export class LicenseManager {
    private static _instance: LicenseManager;

    public static get instance(): LicenseManager {
        if (!LicenseManager._instance) {
            LicenseManager._instance = new LicenseManager();
        }
        return LicenseManager._instance;
    }

    public static readonly MAX_EVALUATION_SECONDS: number = 7200; // 120 minutes (2 hours)
    public static readonly EVALUATION_FRAGMENT_CAP: number = 250; // 250 Soul Fragments Cap (Cliffhanger: 4 kills before Alpha Boss at 254)
    public static readonly PRICE_USD: string = '$12.99';
    public static readonly TELEGRAM_STARS: number = 650;
    public static readonly STRIPE_CHECKOUT_URL: string = 'https://buy.stripe.com/7sYfZgfV28SK67J0Qh8og00';
    public static readonly DEMO_BLOCKED_MAPS: string[] = ['catacombs', 'castle'];

    private static readonly STORAGE_KEY = 'swiftsouls_license_record';

    private license: LicenseRecord;
    private isPaused: boolean = false;
    private celebrationListeners: Array<() => void> = [];
    private tierListeners: Array<(tier: LicenseTier) => void> = [];

    constructor() {
        this.license = this.loadLicense();
        this.checkPremiumVaultBonding();
        this.checkUrlParameters();

        // Listen for tab focus/blur to pause timer during fair play
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('blur', () => this.pauseTimer());
            window.addEventListener('focus', () => this.resumeTimer());
        }
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.pauseTimer();
                } else {
                    this.resumeTimer();
                }
            });
        }
    }

    private loadLicense(): LicenseRecord {
        if (typeof localStorage === 'undefined') {
            return { tier: 'evaluation', activePlaytimeSeconds: 0 };
        }

        try {
            const raw = localStorage.getItem(LicenseManager.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && (parsed.tier === 'evaluation' || parsed.tier === 'commercial')) {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[LicenseManager] Could not parse stored license record:', e);
        }

        return { tier: 'evaluation', activePlaytimeSeconds: 0 };
    }

    private saveLicense(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(LicenseManager.STORAGE_KEY, JSON.stringify(this.license));
        } catch (e) {
            console.error('[LicenseManager] Failed to persist license record:', e);
        }
    }

    /**
     * Re-hydrate commercial license if current user's email is recorded in the Premium Vault.
     */
    public checkPremiumVaultBonding(): void {
        if (typeof localStorage === 'undefined') return;
        const profile = UserAuthManager.instance.getProfile();
        const email = profile.email ? profile.email.toLowerCase() : '';

        if (!email) return;

        try {
            const vaultRaw = localStorage.getItem('swiftsouls_premium_vault');
            if (vaultRaw) {
                const vault = JSON.parse(vaultRaw);
                if (vault && vault[email]) {
                    this.license.tier = 'commercial';
                    this.license.bondedEmail = email;
                    this.license.purchasedAt = vault[email].grantedAt || Date.now();
                    this.license.recoveryToken = vault[email].recoveryToken || this.license.recoveryToken;
                    this.license.paymentRail = vault[email].paymentRail || 'stripe';
                    this.saveLicense();
                    this.notifyTierChange();
                }
            }
        } catch (e) {
            console.warn('[LicenseManager] Error checking premium vault:', e);
        }
    }

    /**
     * Check URL query parameters on boot for order confirmation or token restoration.
     * Supports:
     * - ?order_success=true&email=user@example.com
     * - ?token=SWIFT-XXXX-XXXX
     * - ?verify_email=user@example.com
     */
    public checkUrlParameters(): void {
        if (typeof window === 'undefined' || !window.location) return;

        try {
            const params = new URLSearchParams(window.location.search);
            const orderSuccess = params.get('order_success') === 'true';
            const token = params.get('token') || params.get('recovery_token');
            const email = params.get('email') || params.get('verify_email');

            if (token && this.validateRecoveryToken(token)) {
                console.log('[LicenseManager] Restoring license from URL token:', token);
                this.upgradeToCommercial({
                    paymentRail: 'token',
                    recoveryToken: token.trim().toUpperCase(),
                    bondedEmail: email ? email.toLowerCase() : undefined
                });
                this.cleanUrlParams(['token', 'recovery_token', 'order_success', 'email', 'verify_email']);
                return;
            }

            if (orderSuccess && email) {
                console.log('[LicenseManager] Detected successful order redirect for:', email);
                if (typeof fetch !== 'undefined') {
                    fetch('/api/license/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    })
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.valid) {
                            console.log('[LicenseManager] Order confirmed by backend ledger.');
                            this.upgradeToCommercial({
                                paymentRail: data.order?.paymentRail || 'stripe',
                                recoveryToken: data.order?.token,
                                bondedEmail: email.toLowerCase()
                            });
                        } else {
                            this.upgradeToCommercial({
                                paymentRail: 'stripe',
                                bondedEmail: email.toLowerCase()
                            });
                        }
                    })
                    .catch(err => {
                        console.warn('[LicenseManager] Backend verify unavailable, applying client upgrade:', err);
                        this.upgradeToCommercial({
                            paymentRail: 'stripe',
                            bondedEmail: email.toLowerCase()
                        });
                    });
                } else {
                    this.upgradeToCommercial({
                        paymentRail: 'stripe',
                        bondedEmail: email.toLowerCase()
                    });
                }
                this.cleanUrlParams(['order_success', 'email', 'session_id']);
            }
        } catch (e) {
            console.warn('[LicenseManager] Error checking URL parameters:', e);
        }
    }

    private cleanUrlParams(keysToRemove: string[]): void {
        try {
            if (typeof window === 'undefined' || !window.history || !window.location) return;
            const url = new URL(window.location.href);
            let changed = false;
            keysToRemove.forEach(k => {
                if (url.searchParams.has(k)) {
                    url.searchParams.delete(k);
                    changed = true;
                }
            });
            if (changed) {
                window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : '') + url.hash);
            }
        } catch (e) {
            // Ignore history state errors
        }
    }

    public getTier(): LicenseTier {
        return this.license.tier;
    }

    public isCommercial(): boolean {
        return this.license.tier === 'commercial';
    }

    public isEvaluation(): boolean {
        return this.license.tier === 'evaluation';
    }

    public getActivePlaytimeSeconds(): number {
        return this.license.activePlaytimeSeconds;
    }

    public getRemainingSeconds(): number {
        // Demo mode: no time limit
        return Infinity;
    }

    public isEvaluationExpired(): boolean {
        // Demo mode: timer removed — evaluation never expires
        return false;
    }

    public getTimeRemainingFormatted(): string {
        if (this.isCommercial()) return 'UNLIMITED';
        return 'UNLIMITED';
    }

    public tickActiveSecond(deltaSeconds: number = 1): boolean {
        if (this.isCommercial() || this.isPaused) {
            return false;
        }

        // Still accumulate playtime for telemetry (5-min trial reporting),
        // but never signal expiry — demo timer has been removed.
        this.license.activePlaytimeSeconds += deltaSeconds;
        this.saveLicense();

        return false; // expiry event disabled
    }

    public pauseTimer(): void {
        this.isPaused = true;
    }

    public resumeTimer(): void {
        this.isPaused = false;
    }

    public isTimerPaused(): boolean {
        return this.isPaused;
    }

    /**
     * Map progression boundary check.
     */
    public isMapAllowed(mapId: string): boolean {
        if (this.isCommercial()) return true;
        return !LicenseManager.DEMO_BLOCKED_MAPS.includes(mapId.toLowerCase());
    }

    /**
     * Soul fragment harvesting cap check.
     * Demo mode: fragment limit removed — always allow harvesting.
     */
    public canHarvestFragments(_currentTotalFragments: number): boolean {
        return true;
    }

    /**
     * Generate 12-char cross-device recovery token (Format: SWIFT-XXXX-XXXX).
     */
    public generateRecoveryToken(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let part1 = '';
        let part2 = '';
        for (let i = 0; i < 4; i++) {
            part1 += chars.charAt(Math.floor(Math.random() * chars.length));
            part2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `SWIFT-${part1}-${part2}`;
    }

    /**
     * Validates recovery token format.
     */
    public validateRecoveryToken(token: string): boolean {
        const clean = (token || '').trim().toUpperCase();
        return /^SWIFT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(clean);
    }

    /**
     * Redeem recovery token to unlock Commercial Tier.
     */
    public redeemRecoveryToken(token: string): { success: boolean; message: string } {
        if (!this.validateRecoveryToken(token)) {
            return { success: false, message: 'Invalid token format. Must be SWIFT-XXXX-XXXX.' };
        }

        const profile = UserAuthManager.instance.getProfile();
        const bondedEmail = profile.email ? profile.email.toLowerCase() : 'token_recovery';

        this.upgradeToCommercial({
            paymentRail: 'token',
            recoveryToken: token.trim().toUpperCase(),
            bondedEmail
        });

        return { success: true, message: 'Commercial Tier restored successfully!' };
    }

    /**
     * 1-Click Purchase Initiation:
     * Dual rails:
     * - Web: Stripe Checkout ($12.99 USD)
     * - Telegram Mini App: Telegram.WebApp.openInvoice (650 Stars)
     */
    public initiatePurchase(): {
        rail: 'stripe' | 'telegram_stars';
        checkoutUrl?: string;
        starsAmount?: number;
    } {
        const profile = UserAuthManager.instance.getProfile();
        const email = profile.email ? encodeURIComponent(profile.email) : '';

        // Check if running inside Telegram Mini App
        const hasTgWebApp = typeof window !== 'undefined' && (window as any).Telegram?.WebApp;
        if (hasTgWebApp && (window as any).Telegram.WebApp.openInvoice) {
            try {
                // In Telegram WebApp, trigger invoice modal
                console.log(`[LicenseManager] ⭐️ Invoking Telegram Stars invoice (650 Stars)`);
                // Placeholder invoice slug for Project SwiftSouls Commercial Edition
                (window as any).Telegram.WebApp.openInvoice('https://t.me/$SwiftSouls_Commercial_Invoice', (status: string) => {
                    if (status === 'paid') {
                        this.upgradeToCommercial({ paymentRail: 'telegram_stars' });
                    }
                });
                return { rail: 'telegram_stars', starsAmount: LicenseManager.TELEGRAM_STARS };
            } catch (e) {
                console.warn('[LicenseManager] Telegram openInvoice fallback:', e);
            }
        }

        // Web Browser: Stripe Checkout Rail ($12.99 USD)
        const stripeUrl = email ? `${LicenseManager.STRIPE_CHECKOUT_URL}?prefilled_email=${email}` : LicenseManager.STRIPE_CHECKOUT_URL;
        return { rail: 'stripe', checkoutUrl: stripeUrl };
    }

    /**
     * Elevates the license to Commercial Tier.
     * Generates recovery token, bonds with email, records into swiftsouls_premium_vault, and triggers fanfare.
     */
    public upgradeToCommercial(options?: {
        paymentRail?: 'stripe' | 'telegram_stars' | 'admin_grant' | 'token';
        recoveryToken?: string;
        bondedEmail?: string;
    }): LicenseRecord {
        const profile = UserAuthManager.instance.getProfile();
        const email = options?.bondedEmail || (profile.email ? profile.email.toLowerCase() : 'unlinked_user');
        const token = options?.recoveryToken || this.generateRecoveryToken();
        const rail = options?.paymentRail || 'stripe';

        this.license = {
            tier: 'commercial',
            activePlaytimeSeconds: this.license.activePlaytimeSeconds,
            purchasedAt: Date.now(),
            bondedEmail: email,
            recoveryToken: token,
            paymentRail: rail
        };

        this.saveLicense();

        // Record in isolated Premium Vault
        this.recordInPremiumVault(email, token, rail);

        // Notify celebration & tier listeners
        this.notifyTierChange();
        this.notifyCelebration();

        return { ...this.license };
    }

    /**
     * Revokes commercial license (for admin testing/revocation).
     */
    public revokeCommercial(): void {
        this.license.tier = 'evaluation';
        this.license.paymentRail = undefined;
        this.saveLicense();
        this.notifyTierChange();
    }

    public getRecoveryToken(): string | null {
        return this.license.recoveryToken || null;
    }

    public getBondedEmail(): string | null {
        return this.license.bondedEmail || null;
    }

    public onCelebration(listener: () => void): () => void {
        this.celebrationListeners.push(listener);
        return () => {
            this.celebrationListeners = this.celebrationListeners.filter(l => l !== listener);
        };
    }

    public onTierChange(listener: (tier: LicenseTier) => void): () => void {
        this.tierListeners.push(listener);
        listener(this.license.tier);
        return () => {
            this.tierListeners = this.tierListeners.filter(l => l !== listener);
        };
    }

    private notifyCelebration(): void {
        this.celebrationListeners.forEach(listener => {
            try {
                listener();
            } catch (e) {
                console.error('[LicenseManager] Celebration listener error:', e);
            }
        });
    }

    private notifyTierChange(): void {
        this.tierListeners.forEach(listener => {
            try {
                listener(this.license.tier);
            } catch (e) {
                console.error('[LicenseManager] Tier change listener error:', e);
            }
        });
    }

    private recordInPremiumVault(email: string, recoveryToken: string, paymentRail: string): void {
        if (!email || email === 'unlinked_user') return;
        if (typeof localStorage === 'undefined') return;

        try {
            let vault: { [email: string]: any } = {};
            const vaultRaw = localStorage.getItem('swiftsouls_premium_vault');
            if (vaultRaw) {
                vault = JSON.parse(vaultRaw) || {};
            }

            vault[email.toLowerCase()] = {
                email: email.toLowerCase(),
                tier: 'commercial',
                paymentRail,
                recoveryToken,
                grantedAt: Date.now()
            };

            localStorage.setItem('swiftsouls_premium_vault', JSON.stringify(vault));
        } catch (e) {
            console.error('[LicenseManager] Failed to record in premium vault:', e);
        }
    }
}
