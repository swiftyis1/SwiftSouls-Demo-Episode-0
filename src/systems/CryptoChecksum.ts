/**
 * CryptoChecksum: High-performance, zero-dependency cryptographic hashing system.
 * Implements standard FIPS 180-4 SHA-256 and RFC 2104 HMAC-SHA256 in pure TypeScript.
 * Provides deterministic, synchronous tamper-proofing for SwiftSouls save files.
 */
export class CryptoChecksum {
    // Secret application salt embedded in client engine to prevent trivial hash forgery
    private static readonly HMAC_SECRET: string = 'SwiftSouls_v2_HMAC_Salt_998471203';

    // SHA-256 initial hash values (first 32 bits of fractional parts of square roots of first 8 primes)
    private static readonly H_INIT: Uint32Array = new Uint32Array([
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);

    // SHA-256 round constants (first 32 bits of fractional parts of cube roots of first 64 primes)
    private static readonly K: Uint32Array = new Uint32Array([
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ]);

    private static rotr(x: number, n: number): number {
        return (x >>> n) | (x << (32 - n));
    }

    private static utf8Encode(str: string): Uint8Array {
        if (typeof TextEncoder !== 'undefined') {
            return new TextEncoder().encode(str);
        }
        // Fallback UTF-8 encoder if TextEncoder is unavailable
        const utf8: number[] = [];
        for (let i = 0; i < str.length; i++) {
            let charcode = str.charCodeAt(i);
            if (charcode < 0x80) {
                utf8.push(charcode);
            } else if (charcode < 0x800) {
                utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
            } else if (charcode < 0xd800 || charcode >= 0xe000) {
                utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
            } else {
                i++;
                charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
                utf8.push(
                    0xf0 | (charcode >> 18),
                    0x80 | ((charcode >> 12) & 0x3f),
                    0x80 | ((charcode >> 6) & 0x3f),
                    0x80 | (charcode & 0x3f)
                );
            }
        }
        return new Uint8Array(utf8);
    }

    /**
     * Internal raw SHA-256 core operating on Uint8Array.
     */
    private static sha256Bytes(data: Uint8Array): Uint8Array {
        const dataLen = data.length;
        // Pad data: data + 0x80 + zeros + 64-bit big-endian length in bits
        const bitLen = dataLen * 8;
        const padLen = (dataLen % 64 < 56) ? (56 - (dataLen % 64)) : (120 - (dataLen % 64));
        const totalLen = dataLen + padLen + 8;
        const padded = new Uint8Array(totalLen);
        padded.set(data);
        padded[dataLen] = 0x80;

        // Append 64-bit bit length (big-endian)
        const view = new DataView(padded.buffer);
        // High 32 bits (support up to 53-bit integers safe in JS)
        view.setUint32(totalLen - 8, Math.floor(bitLen / 0x100000000), false);
        view.setUint32(totalLen - 4, bitLen >>> 0, false);

        const h = new Uint32Array(CryptoChecksum.H_INIT);
        const w = new Uint32Array(64);

        for (let offset = 0; offset < totalLen; offset += 64) {
            for (let i = 0; i < 16; i++) {
                w[i] = view.getUint32(offset + (i * 4), false);
            }

            for (let i = 16; i < 64; i++) {
                const s0 = CryptoChecksum.rotr(w[i - 15], 7) ^ CryptoChecksum.rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
                const s1 = CryptoChecksum.rotr(w[i - 2], 17) ^ CryptoChecksum.rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
                w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
            }

            let a = h[0];
            let b = h[1];
            let c = h[2];
            let d = h[3];
            let e = h[4];
            let f = h[5];
            let g = h[6];
            let hVal = h[7];

            for (let i = 0; i < 64; i++) {
                const S1 = CryptoChecksum.rotr(e, 6) ^ CryptoChecksum.rotr(e, 11) ^ CryptoChecksum.rotr(e, 25);
                const ch = (e & f) ^ (~e & g);
                const temp1 = (hVal + S1 + ch + CryptoChecksum.K[i] + w[i]) >>> 0;
                const S0 = CryptoChecksum.rotr(a, 2) ^ CryptoChecksum.rotr(a, 13) ^ CryptoChecksum.rotr(a, 22);
                const maj = (a & b) ^ (a & c) ^ (b & c);
                const temp2 = (S0 + maj) >>> 0;

                hVal = g;
                g = f;
                f = e;
                e = (d + temp1) >>> 0;
                d = c;
                c = b;
                b = a;
                a = (temp1 + temp2) >>> 0;
            }

            h[0] = (h[0] + a) >>> 0;
            h[1] = (h[1] + b) >>> 0;
            h[2] = (h[2] + c) >>> 0;
            h[3] = (h[3] + d) >>> 0;
            h[4] = (h[4] + e) >>> 0;
            h[5] = (h[5] + f) >>> 0;
            h[6] = (h[6] + g) >>> 0;
            h[7] = (h[7] + hVal) >>> 0;
        }

        const out = new Uint8Array(32);
        const outView = new DataView(out.buffer);
        for (let i = 0; i < 8; i++) {
            outView.setUint32(i * 4, h[i], false);
        }
        return out;
    }

    /**
     * Computes the standard SHA-256 hex digest for a string.
     */
    public static sha256(message: string): string {
        const bytes = this.utf8Encode(message);
        const hash = this.sha256Bytes(bytes);
        return Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Computes standard HMAC-SHA256 digest returning a 32-byte Uint8Array (RFC 2104).
     * Accepts either UTF-8 strings or raw byte arrays for key and message.
     */
    public static hmacSha256Bytes(key: string | Uint8Array, message: string | Uint8Array): Uint8Array {
        let keyBytes = typeof key === 'string' ? this.utf8Encode(key) : key;
        // Keys longer than 64 bytes are shortened by hashing them
        if (keyBytes.length > 64) {
            keyBytes = this.sha256Bytes(keyBytes);
        }
        // Keys shorter than 64 bytes are zero-padded to 64 bytes
        const kPad = new Uint8Array(64);
        kPad.set(keyBytes);

        const iPad = new Uint8Array(64);
        const oPad = new Uint8Array(64);
        for (let i = 0; i < 64; i++) {
            iPad[i] = kPad[i] ^ 0x36;
            oPad[i] = kPad[i] ^ 0x5c;
        }

        const msgBytes = typeof message === 'string' ? this.utf8Encode(message) : message;
        const innerMsg = new Uint8Array(64 + msgBytes.length);
        innerMsg.set(iPad);
        innerMsg.set(msgBytes, 64);
        const innerHash = this.sha256Bytes(innerMsg);

        const outerMsg = new Uint8Array(64 + 32);
        outerMsg.set(oPad);
        outerMsg.set(innerHash, 64);
        return this.sha256Bytes(outerMsg);
    }

    /**
     * Computes standard HMAC-SHA256 hex digest for a key and message (RFC 2104).
     */
    public static hmacSha256(key: string | Uint8Array, message: string | Uint8Array): string {
        const bytes = this.hmacSha256Bytes(key, message);
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Constant-time equality comparison between two strings to mitigate timing attacks.
     */
    public static constantTimeEqual(a: string, b: string): boolean {
        if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
            return false;
        }
        let diff = 0;
        for (let i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return diff === 0;
    }

    /**
     * Generates a tamper-proof cryptographic signature for a save payload.
     * Incorporates slot number, timestamp, payload string, and application secret salt.
     */
    public static signSavePayload(slot: number, timestamp: number, payload: string): string {
        const canonicalHeader = `SLOT:${slot}|TS:${timestamp}|LEN:${payload.length}`;
        const signedMessage = `${canonicalHeader}::${payload}`;
        return this.hmacSha256(this.HMAC_SECRET, signedMessage);
    }

    /**
     * Verifies whether the provided signature matches the save payload.
     * Constant-time comparison is employed to prevent timing attacks.
     */
    public static verifySignature(slot: number, timestamp: number, payload: string, signature: string): boolean {
        if (!signature || typeof signature !== 'string' || signature.length !== 64) {
            return false;
        }
        const expected = this.signSavePayload(slot, timestamp, payload);
        return this.constantTimeEqual(expected, signature);
    }
}
