/**
 * UserAuthManager: Player identity and authentication management system.
 * Supports:
 * - 1-Click Google Identity / OAuth2 authentication
 * - Custom Email login with 6-digit OTP verification (10m TTL, 60s cooldown, dev-toast)
 * - Telegram WebApp identity integration
 * - Zero-password Administrator authorization for davidswift0920@gmail.com
 * - Smart Save Slot allocation (Next Open Slot or Overwrite Selection) with ZERO save merging
 * - Automatic Commercial Tier re-hydration from Premium Vault
 */

export type AuthProvider = 'google' | 'email' | 'telegram' | 'guest';

export interface UserProfile {
    id: string;
    email: string;
    displayName: string;
    authProvider: AuthProvider;
    avatarUrl?: string;
    verified: boolean;
    linkedAt: number;
    isAdmin: boolean;
}

export interface OTPRecord {
    code: string;
    expiresAt: number;
    attempts: number;
    lastRequestedAt: number;
}

export interface SlotAllocationStatus {
    hasOpenSlot: boolean;
    nextOpenSlot: number | null; // 1, 2, or 3
    occupiedSlots: Array<{
        slot: number;
        name: string;
        level: number;
        timestamp?: number;
    }>;
}

export class UserAuthManager {
    private static _instance: UserAuthManager;

    public static get instance(): UserAuthManager {
        if (!UserAuthManager._instance) {
            UserAuthManager._instance = new UserAuthManager();
        }
        return UserAuthManager._instance;
    }

    public static readonly ADMIN_EMAILS: string[] = ['davidswift0920@gmail.com'];
    private static readonly PROFILE_STORAGE_KEY = 'swiftsouls_user_profile';
    private static readonly OTP_STORAGE_PREFIX = 'swiftsouls_otp_';
    private static readonly OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
    private static readonly OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds

    private profile: UserProfile;
    private authListeners: Array<(profile: UserProfile) => void> = [];

    constructor() {
        this.profile = this.loadProfileFromStorage();
        this.checkAdminStatus();
    }

    /**
     * Subscribe to authentication profile updates.
     */
    public onAuthStateChange(listener: (profile: UserProfile) => void): () => void {
        this.authListeners.push(listener);
        listener(this.profile);
        return () => {
            this.authListeners = this.authListeners.filter(l => l !== listener);
        };
    }

    private notifyListeners(): void {
        this.authListeners.forEach(listener => {
            try {
                listener(this.profile);
            } catch (e) {
                console.error('[UserAuthManager] Error in auth listener:', e);
            }
        });
    }

    public getProfile(): UserProfile {
        return { ...this.profile };
    }

    public isLoggedIn(): boolean {
        return this.profile.authProvider !== 'guest' && this.profile.verified;
    }

    public isAdmin(): boolean {
        return this.profile.isAdmin;
    }

    private checkAdminStatus(): void {
        const emailLower = (this.profile.email || '').trim().toLowerCase();
        const isAdminEmail = UserAuthManager.ADMIN_EMAILS.some(e => e.toLowerCase() === emailLower);
        
        if (isAdminEmail) {
            this.profile.isAdmin = true;
            this.profile.verified = true;
            this.saveProfileToStorage();
        }
    }

    /**
     * Load stored profile or create default guest profile.
     */
    private loadProfileFromStorage(): UserProfile {
        if (typeof localStorage === 'undefined') {
            return this.createGuestProfile();
        }

        try {
            const raw = localStorage.getItem(UserAuthManager.PROFILE_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed.id === 'string' && typeof parsed.authProvider === 'string') {
                    return parsed;
                }
            }
        } catch (e) {
            console.warn('[UserAuthManager] Could not parse stored user profile:', e);
        }

        return this.createGuestProfile();
    }

    private createGuestProfile(): UserProfile {
        let guestId = 'guest_' + Math.random().toString(36).substring(2, 9);
        return {
            id: guestId,
            email: '',
            displayName: 'Adventurer',
            authProvider: 'guest',
            verified: false,
            linkedAt: Date.now(),
            isAdmin: false
        };
    }

    private saveProfileToStorage(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(UserAuthManager.PROFILE_STORAGE_KEY, JSON.stringify(this.profile));
        } catch (e) {
            console.error('[UserAuthManager] Failed to persist user profile:', e);
        }
    }

    /**
     * 1-Click Google Identity / OAuth authentication.
     * Google pre-authenticates the user; identity is verified immediately.
     */
    public signInWithGoogle(payload: {
        email: string;
        displayName?: string;
        avatarUrl?: string;
        googleId?: string;
    }): { success: boolean; profile: UserProfile; isAdmin: boolean } {
        const cleanEmail = payload.email.trim().toLowerCase();
        const isAdmin = UserAuthManager.ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);

        this.profile = {
            id: payload.googleId || 'google_' + btoa(cleanEmail).substring(0, 12),
            email: cleanEmail,
            displayName: payload.displayName || cleanEmail.split('@')[0] || 'SwiftHero',
            authProvider: 'google',
            avatarUrl: payload.avatarUrl,
            verified: true, // Google pre-verifies email
            linkedAt: Date.now(),
            isAdmin
        };

        this.saveProfileToStorage();
        this.notifyListeners();

        // Check premium vault hydration
        this.checkPremiumVaultHydration(cleanEmail);

        return { success: true, profile: this.getProfile(), isAdmin };
    }

    /**
     * Custom Email Login: Request a 6-digit OTP verification code.
     * Enforces a 60-second cooldown and 10-minute expiry.
     */
    public requestEmailVerificationCode(email: string): {
        success: boolean;
        message: string;
        cooldownRemaining?: number;
        devCode?: string;
    } {
        const cleanEmail = email.trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            return { success: false, message: 'Please enter a valid email address.' };
        }

        const now = Date.now();
        const storedOTP = this.getStoredOTP(cleanEmail);

        // Check 60-second cooldown
        if (storedOTP && now - storedOTP.lastRequestedAt < UserAuthManager.OTP_COOLDOWN_MS) {
            const remaining = Math.ceil((UserAuthManager.OTP_COOLDOWN_MS - (now - storedOTP.lastRequestedAt)) / 1000);
            return {
                success: false,
                message: `Please wait ${remaining}s before requesting a new code.`,
                cooldownRemaining: remaining
            };
        }

        // Generate 6-digit numeric OTP code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const otpRecord: OTPRecord = {
            code,
            expiresAt: now + UserAuthManager.OTP_EXPIRY_MS,
            attempts: 0,
            lastRequestedAt: now
        };

        this.storeOTP(cleanEmail, otpRecord);

        // In dev / browser environment, log dev code toast for friction-free pair programming
        console.log(`[SwiftSouls Auth] 🔐 6-Digit OTP Code for ${cleanEmail}: ${code} (Expires in 10m)`);

        return {
            success: true,
            message: `Verification code sent to ${cleanEmail}. (Code expires in 10 minutes)`,
            devCode: code // Provided for automated testing / dev toast
        };
    }

    /**
     * Custom Email Login: Verify the 6-digit OTP code.
     */
    public verifyEmailCode(email: string, inputCode: string): {
        success: boolean;
        message?: string;
        profile?: UserProfile;
    } {
        const cleanEmail = email.trim().toLowerCase();
        const cleanCode = inputCode.trim();

        const stored = this.getStoredOTP(cleanEmail);
        if (!stored) {
            return { success: false, message: 'No verification code requested for this email.' };
        }

        const now = Date.now();
        if (now > stored.expiresAt) {
            this.clearStoredOTP(cleanEmail);
            return { success: false, message: 'Verification code has expired. Please request a new one.' };
        }

        if (stored.attempts >= 5) {
            this.clearStoredOTP(cleanEmail);
            return { success: false, message: 'Too many failed attempts. Please request a new code.' };
        }

        stored.attempts++;
        this.storeOTP(cleanEmail, stored);

        if (stored.code !== cleanCode) {
            return { success: false, message: 'Incorrect verification code. Please try again.' };
        }

        // Code verified successfully!
        this.clearStoredOTP(cleanEmail);

        const isAdmin = UserAuthManager.ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);

        this.profile = {
            id: 'email_' + btoa(cleanEmail).substring(0, 12),
            email: cleanEmail,
            displayName: cleanEmail.split('@')[0] || 'SwiftHero',
            authProvider: 'email',
            verified: true,
            linkedAt: Date.now(),
            isAdmin
        };

        this.saveProfileToStorage();
        this.notifyListeners();

        // Check premium vault hydration
        this.checkPremiumVaultHydration(cleanEmail);

        return { success: true, message: 'Email verified successfully!', profile: this.getProfile() };
    }

    /**
     * Telegram Mini App Identity sign-in.
     */
    public signInWithTelegram(telegramUser: {
        id: number;
        first_name: string;
        username?: string;
    }): { success: boolean; profile: UserProfile } {
        this.profile = {
            id: 'tg_' + telegramUser.id,
            email: telegramUser.username ? `@${telegramUser.username}` : `tg_${telegramUser.id}@telegram.org`,
            displayName: telegramUser.first_name || telegramUser.username || 'Telegram Adventurer',
            authProvider: 'telegram',
            verified: true,
            linkedAt: Date.now(),
            isAdmin: false
        };

        this.saveProfileToStorage();
        this.notifyListeners();

        return { success: true, profile: this.getProfile() };
    }

    /**
     * Disconnect account and revert to guest profile.
     */
    public disconnectAccount(): void {
        this.profile = this.createGuestProfile();
        this.saveProfileToStorage();
        this.notifyListeners();
    }

    /**
     * Wipe all cached authentication data and OTP records.
     */
    public wipeLocalCache(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.removeItem(UserAuthManager.PROFILE_STORAGE_KEY);
            // Clear any OTP keys
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(UserAuthManager.OTP_STORAGE_PREFIX)) {
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.error('[UserAuthManager] Error wiping local cache:', e);
        }
        this.profile = this.createGuestProfile();
        this.notifyListeners();
    }

    /**
     * Smart Save Slot Allocation Query:
     * Inspects primary save slots (1, 2, and 3).
     * If an empty slot exists, returns it as `nextOpenSlot`.
     * If all 3 slots are occupied, returns `hasOpenSlot: false` and lists all occupied slots.
     */
    public getSlotAllocationStatus(): SlotAllocationStatus {
        const occupied: SlotAllocationStatus['occupiedSlots'] = [];
        let nextOpenSlot: number | null = null;

        const checkSlots = [1, 2, 3];
        for (const slot of checkSlots) {
            let slotData: string | null = null;
            if (typeof localStorage !== 'undefined') {
                slotData = localStorage.getItem('swiftsouls_save_' + slot);
            }

            if (slotData) {
                try {
                    const parsed = JSON.parse(slotData);
                    let name = 'Swift';
                    let level = 1;
                    let ts = Date.now();

                    if (parsed.version === 2 && parsed.payload) {
                        const payloadState = JSON.parse(parsed.payload);
                        name = payloadState.party?.[0]?.name || 'Swift';
                        level = payloadState.party?.[0]?.level || 1;
                        ts = parsed.timestamp || ts;
                    } else if (parsed.party) {
                        name = parsed.party[0]?.name || 'Swift';
                        level = parsed.party[0]?.level || 1;
                    }

                    occupied.push({ slot, name, level, timestamp: ts });
                } catch {
                    occupied.push({ slot, name: 'Corrupted Save', level: 0 });
                }
            } else if (nextOpenSlot === null) {
                nextOpenSlot = slot;
            }
        }

        return {
            hasOpenSlot: nextOpenSlot !== null,
            nextOpenSlot,
            occupiedSlots: occupied
        };
    }

    /**
     * Allocates guest session data to targetSlot.
     * STRICT INVARIANT: Does NOT merge, blend, or add soul fragments to existing slots.
     */
    public allocateGuestProgressToSlot(targetSlot: number, serializedPayload: string): boolean {
        if (targetSlot < 1 || targetSlot > 3) {
            console.error('[UserAuthManager] Invalid target slot for allocation:', targetSlot);
            return false;
        }

        if (typeof localStorage === 'undefined') return false;

        try {
            // Import dynamically or use standard format to prevent circular reference
            const timestamp = Date.now();
            const envelope = {
                version: 2,
                slot: targetSlot,
                timestamp,
                signature: 'allocated_slot_' + targetSlot + '_' + timestamp,
                payload: serializedPayload
            };

            localStorage.setItem('swiftsouls_save_' + targetSlot, JSON.stringify(envelope));
            return true;
        } catch (e) {
            console.error('[UserAuthManager] Failed to allocate guest progress to slot:', e);
            return false;
        }
    }

    // --- Private Helper Methods ---

    private getStoredOTP(email: string): OTPRecord | null {
        if (typeof localStorage === 'undefined') return null;
        try {
            const raw = localStorage.getItem(UserAuthManager.OTP_STORAGE_PREFIX + email);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    private storeOTP(email: string, record: OTPRecord): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(UserAuthManager.OTP_STORAGE_PREFIX + email, JSON.stringify(record));
        } catch (e) {
            console.error('[UserAuthManager] Error saving OTP:', e);
        }
    }

    private clearStoredOTP(email: string): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.removeItem(UserAuthManager.OTP_STORAGE_PREFIX + email);
        } catch {}
    }

    private checkPremiumVaultHydration(email: string): void {
        if (!email) return;
        if (typeof localStorage === 'undefined') return;
        try {
            const vaultRaw = localStorage.getItem('swiftsouls_premium_vault');
            if (vaultRaw) {
                const vault = JSON.parse(vaultRaw);
                if (vault && vault[email.toLowerCase()]) {
                    console.log(`[UserAuthManager] 🌟 Auto-hydrated Commercial License from Premium Vault for ${email}`);
                    // Signal license elevation in local storage
                    const licenseRecord = {
                        tier: 'commercial',
                        activePlaytimeSeconds: 0,
                        purchasedAt: vault[email.toLowerCase()].grantedAt || Date.now(),
                        bondedEmail: email.toLowerCase(),
                        recoveryToken: vault[email.toLowerCase()].recoveryToken || 'SWIFT-AUTO-RESTORED'
                    };
                    localStorage.setItem('swiftsouls_license_record', JSON.stringify(licenseRecord));
                }
            }
        } catch (e) {
            console.warn('[UserAuthManager] Failed to check premium vault hydration:', e);
        }
    }
}
