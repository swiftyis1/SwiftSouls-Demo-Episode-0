/**
 * AccessibilityManager.ts
 * Sprint 24: Player-configurable accessibility and visual comfort settings.
 * Persists user preferences to localStorage for Screen Shake and Combat Flashes.
 */

export class AccessibilityManager {
    public static readonly STORAGE_KEY_SCREEN_SHAKE = 'swiftsouls_screen_shake';
    public static readonly STORAGE_KEY_COMBAT_FLASHES = 'swiftsouls_combat_flashes';

    private static _screenShake: boolean = true;
    private static _combatFlashes: boolean = true;
    private static _initialized: boolean = false;

    /**
     * Initializes accessibility preferences from localStorage if present.
     */
    public static init(): void {
        if (typeof localStorage !== 'undefined') {
            try {
                const shakeVal = localStorage.getItem(this.STORAGE_KEY_SCREEN_SHAKE);
                if (shakeVal !== null) {
                    this._screenShake = shakeVal === 'true';
                }

                const flashVal = localStorage.getItem(this.STORAGE_KEY_COMBAT_FLASHES);
                if (flashVal !== null) {
                    this._combatFlashes = flashVal === 'true';
                }
            } catch (e) {
                console.warn('[AccessibilityManager] Failed to read settings from localStorage:', e);
            }
        }
        this._initialized = true;
    }

    public static isScreenShakeEnabled(): boolean {
        if (!this._initialized) this.init();
        return this._screenShake;
    }

    public static setScreenShakeEnabled(enabled: boolean): void {
        this._screenShake = enabled;
        this._initialized = true;
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(this.STORAGE_KEY_SCREEN_SHAKE, enabled ? 'true' : 'false');
            } catch (e) {
                console.warn('[AccessibilityManager] Failed to persist screen shake setting:', e);
            }
        }
    }

    public static toggleScreenShake(): boolean {
        const next = !this.isScreenShakeEnabled();
        this.setScreenShakeEnabled(next);
        return next;
    }

    public static isCombatFlashesEnabled(): boolean {
        if (!this._initialized) this.init();
        return this._combatFlashes;
    }

    public static setCombatFlashesEnabled(enabled: boolean): void {
        this._combatFlashes = enabled;
        this._initialized = true;
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(this.STORAGE_KEY_COMBAT_FLASHES, enabled ? 'true' : 'false');
            } catch (e) {
                console.warn('[AccessibilityManager] Failed to persist combat flashes setting:', e);
            }
        }
    }

    public static toggleCombatFlashes(): boolean {
        const next = !this.isCombatFlashesEnabled();
        this.setCombatFlashesEnabled(next);
        return next;
    }

    /**
     * Safe wrapper around camera shake that respects player accessibility preferences.
     */
    public static shakeCamera(camera: any, duration: number = 200, intensity: number = 0.01): void {
        if (!camera || typeof camera.shake !== 'function') return;
        if (this.isScreenShakeEnabled()) {
            camera.shake(duration, intensity);
        }
    }

    /**
     * Safe wrapper around camera flash that respects player visual comfort preferences.
     */
    public static flashCamera(
        camera: any,
        duration: number = 250,
        red: number = 255,
        green: number = 255,
        blue: number = 255,
        force: boolean = false
    ): void {
        if (!camera || typeof camera.flash !== 'function') return;
        if (this.isCombatFlashesEnabled()) {
            camera.flash(duration, red, green, blue, force);
        }
    }

    /**
     * Resets accessibility toggles to defaults (useful for testing or profile wipes).
     */
    public static resetDefaults(): void {
        this._screenShake = true;
        this._combatFlashes = true;
        this._initialized = true;
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.removeItem(this.STORAGE_KEY_SCREEN_SHAKE);
                localStorage.removeItem(this.STORAGE_KEY_COMBAT_FLASHES);
            } catch (e) {
                // Ignore
            }
        }
    }
}
