import { CryptoChecksum } from './CryptoChecksum.ts';

export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
}

export interface TelegramInitData {
    query_id?: string;
    user?: TelegramUser;
    auth_date: number;
    hash: string;
    rawParams: { [key: string]: string };
}

export interface TelegramAuthResult {
    valid: boolean;
    user: TelegramUser | null;
    authDate?: number;
    error?: string;
    isExpired?: boolean;
}

/**
 * TelegramAuth: Validates Telegram Mini App WebApp initData signatures and manages player identity.
 * Implements Telegram's official HMAC-SHA256 authentication specification.
 */
export class TelegramAuth {
    // Default fallback token for development/simulated testing environments
    public static readonly DEFAULT_BOT_TOKEN: string = 'SwiftSouls_Telegram_Bot_Token_v18';

    /**
     * Parses a raw query string (e.g., "query_id=...&user=...&auth_date=...&hash=...")
     */
    public static parseInitData(queryString: string): TelegramInitData | null {
        if (!queryString || typeof queryString !== 'string') {
            return null;
        }

        // Clean leading '?' or '#' if present
        let cleaned = queryString.trim();
        if (cleaned.startsWith('?') || cleaned.startsWith('#')) {
            cleaned = cleaned.substring(1);
        }

        // If prefixed with tgWebAppData=, strip it
        if (cleaned.startsWith('tgWebAppData=')) {
            cleaned = cleaned.substring('tgWebAppData='.length);
        }

        // URL-decode if the entire payload is URI encoded
        if (cleaned.includes('%3D') || cleaned.includes('%26')) {
            try {
                cleaned = decodeURIComponent(cleaned);
            } catch {
                // Keep cleaned as is if decode fails
            }
        }

        const params = new URLSearchParams(cleaned);
        const rawParams: { [key: string]: string } = {};
        let hash = '';
        let authDate = 0;
        let queryId: string | undefined;
        let user: TelegramUser | undefined;

        params.forEach((val, key) => {
            rawParams[key] = val;
            if (key === 'hash') {
                hash = val;
            } else if (key === 'auth_date') {
                authDate = parseInt(val, 10);
            } else if (key === 'query_id') {
                queryId = val;
            } else if (key === 'user') {
                try {
                    user = JSON.parse(val);
                } catch {
                    // Malformed user JSON
                }
            }
        });

        if (!hash || !authDate) {
            return null;
        }

        return {
            query_id: queryId,
            user,
            auth_date: authDate,
            hash,
            rawParams
        };
    }

    /**
     * Verifies Telegram WebApp initData query string per official Telegram Mini Apps spec:
     * 1. Sort all key-value pairs (excluding 'hash') alphabetically
     * 2. Join as key=value with newline '\n' delimiter
     * 3. Derive secret key: HMAC_SHA256("WebAppData", botToken)
     * 4. Compute expected hash: HMAC_SHA256(secretKey, dataCheckString)
     * 5. Constant-time compare expected hash with payload hash
     */
    public static verifyInitData(queryString: string, botToken: string = this.DEFAULT_BOT_TOKEN, maxAgeSeconds?: number): TelegramAuthResult {
        const parsed = this.parseInitData(queryString);
        if (!parsed) {
            return { valid: false, user: null, error: 'Malformed or missing initData parameters.' };
        }

        // Check freshness if maxAgeSeconds is set
        if (maxAgeSeconds && maxAgeSeconds > 0) {
            const nowSec = Math.floor(Date.now() / 1000);
            if (nowSec - parsed.auth_date > maxAgeSeconds) {
                return {
                    valid: false,
                    user: parsed.user || null,
                    authDate: parsed.auth_date,
                    isExpired: true,
                    error: 'initData signature has expired.'
                };
            }
        }

        // 1. Build sorted data-check-string (excluding 'hash')
        const sortedKeys = Object.keys(parsed.rawParams)
            .filter(k => k !== 'hash')
            .sort();

        const dataCheckString = sortedKeys
            .map(k => `${k}=${parsed.rawParams[k]}`)
            .join('\n');

        // 2. Derive secret key: HMAC_SHA256(key="WebAppData", message=botToken)
        const secretKey = CryptoChecksum.hmacSha256Bytes('WebAppData', botToken);

        // 3. Compute expected hash: HMAC_SHA256(key=secretKey, message=dataCheckString)
        const expectedHash = CryptoChecksum.hmacSha256(secretKey, dataCheckString);

        // 4. Constant-time equality check
        const isValid = CryptoChecksum.constantTimeEqual(expectedHash.toLowerCase(), parsed.hash.toLowerCase());

        if (!isValid) {
            return {
                valid: false,
                user: null,
                authDate: parsed.auth_date,
                error: 'Cryptographic hash mismatch. Unauthorized or tampered initData.'
            };
        }

        return {
            valid: true,
            user: parsed.user || null,
            authDate: parsed.auth_date
        };
    }

    /**
     * Inspects browser environment to detect Telegram WebApp context.
     * Looks in window.Telegram.WebApp.initData, location hash (#tgWebAppData=...), and query parameters.
     */
    public static detectTelegramEnvironment(): { isTelegram: boolean; initDataString: string | null } {
        try {
            // 1. Check window.Telegram.WebApp.initData
            if (typeof window !== 'undefined') {
                const tg = (window as any).Telegram?.WebApp;
                if (tg && typeof tg.initData === 'string' && tg.initData.length > 0) {
                    return { isTelegram: true, initDataString: tg.initData };
                }

                // 2. Check URL hash (#tgWebAppData=...)
                const hash = window.location.hash;
                if (hash.includes('tgWebAppData=')) {
                    const match = hash.match(/tgWebAppData=([^&]+)/);
                    if (match && match[1]) {
                        return { isTelegram: true, initDataString: decodeURIComponent(match[1]) };
                    }
                }

                // 3. Check search params (?tgWebAppData=... or ?initData=...)
                const search = window.location.search;
                if (search.includes('tgWebAppData=') || search.includes('initData=')) {
                    const params = new URLSearchParams(search);
                    const raw = params.get('tgWebAppData') || params.get('initData');
                    if (raw) {
                        return { isTelegram: true, initDataString: raw };
                    }
                }
            }
        } catch {
            // Environment access error
        }

        return { isTelegram: false, initDataString: null };
    }

    /**
     * Helper to generate a 100% valid cryptographically signed initData string.
     * Used for automated test suites, QA mocks, and offline validation.
     */
    public static generateMockInitData(user: TelegramUser, botToken: string = this.DEFAULT_BOT_TOKEN, authDate?: number): string {
        const date = authDate !== undefined ? authDate : Math.floor(Date.now() / 1000);
        const userJson = JSON.stringify(user);
        const queryId = 'AAH_' + Math.floor(Math.random() * 1000000000);

        const params: { [key: string]: string } = {
            query_id: queryId,
            user: userJson,
            auth_date: date.toString()
        };

        const sortedKeys = Object.keys(params).sort();
        const dataCheckString = sortedKeys.map(k => `${k}=${params[k]}`).join('\n');

        const secretKey = CryptoChecksum.hmacSha256Bytes('WebAppData', botToken);
        const hash = CryptoChecksum.hmacSha256(secretKey, dataCheckString);

        return `query_id=${encodeURIComponent(queryId)}&user=${encodeURIComponent(userJson)}&auth_date=${date}&hash=${hash}`;
    }
}
