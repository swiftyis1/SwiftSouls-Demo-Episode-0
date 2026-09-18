# TERMS OF SERVICE — PROJECT SWIFTSOULS

**Effective Date:** September 5, 2026  
**Last Updated:** September 5, 2026  
**Operator:** David Swift ("Operator", "We", "Our", "Us")  
**Service:** Project SwiftSouls Web Game, Cloud Synchronization, Live-Ops, and Account Services (the "Service")  

Welcome to Project SwiftSouls. By accessing or using the Service, connecting an account (Google Identity, Verified Email, or Telegram), or playing via web browser or Telegram Mini App, you agree to comply with and be bound by these Terms of Service ("Terms"). Please read them carefully.

---

## 1. ACCEPTANCE OF TERMS

By creating an account, authenticating via OAuth or OTP, playing the game, or purchasing a Commercial license, you represent that you are at least 13 years of age (or the minimum legal age in your jurisdiction) and possess the legal capacity to enter into these Terms. If you do not agree to these Terms, you may not access or use the Service.

---

## 2. USER ACCOUNTS & IDENTITY AUTHENTICATION

1. **Authentication Options:**
   * **Sign in with Google:** Instant 1-click verification leveraging Google Identity Services.
   * **Sign in with Email:** Custom email verification requiring a time-sensitive 6-digit One-Time Password (OTP) dispatched with a 10-minute expiry and 60-second resend cooldown.
   * **Telegram Mini App:** Integrated Telegram WebApp authentication matching user Telegram ID.
   * **Guest Mode:** Local temporary session saved into browser storage.
2. **Account Responsibility:** You are responsible for safeguarding your login credentials, email inbox, and 12-character offline recovery tokens. You agree to notify us immediately of any unauthorized use of your account.
3. **Save Slot Allocation Invariant:**
   * When signing in from a Guest session, your progress is allocated to the **next open save slot** (Slot 0, 1, or 2).
   * If all three slots are occupied, an interactive modal prompts you to select which slot to overwrite.
   * **Zero Merging Policy:** Save states, fragment counters, and extinction records are **never mathematically blended or merged** across slots, guaranteeing zero data corruption.
4. **Administrative Access:**
   * Administrative privileges and the Live-Ops Dashboard are restricted to pre-authorized administrator accounts (`davidswift0920@gmail.com`).
   * Unauthorized attempts to access administrative endpoints (`#admin`) are logged and rejected.

---

## 3. PURCHASES, FEES & REFUNDS

1. **Pricing:** The Commercial Tier of Project SwiftSouls is priced at **$12.99 USD** (via Stripe Checkout) or **650 Telegram Stars** (via Telegram Mini Apps). Prices are subject to local taxes and platform fees where applicable.
2. **Digital Goods & Instant Fulfillment:** The Commercial license is a digital good delivered immediately upon payment confirmation. Once unlocked, the commercial license is cryptographically bonded to your verified email or account ID.
3. **Refund Policy:** Due to the instant delivery and permanent digital bonding of the license, purchases are generally non-refundable unless required by applicable law or storefront policy (e.g., Steam or Google Play statutory return windows where applicable). If you experience technical defects preventing play, contact `davidswift0920@gmail.com` for manual recovery or refund review.

---

## 4. CODE OF CONDUCT & FAIR PLAY

You agree to use the Service only for lawful purposes. You shall not:
1. Exploit bugs, glitches, or unintended game mechanics to artificially manipulate leaderboard telemetry or extinction counts.
2. Reverse engineer, decompile, or tamper with the cryptographic checksums (`CryptoChecksum.ts`) or the Premium Vault (`swiftsouls_premium_vault`).
3. Flood the bug reporting or authentication systems with automated, repetitive, or malicious requests (subject to 60-second rate limiting).
4. Impersonate any person or entity, including the game developers, moderators, or other players.

---

## 5. CLOUD SYNC & DATA INTEGRITY

1. **Cloud Synchronization:** Cloud saves are synchronized using conflict-resolution timestamps and cryptographic hashes. The Operator makes reasonable efforts to protect against data loss through rolling 24-hour automated backups.
2. **Local Caching:** Save data is cached locally in your browser’s `localStorage`. Clearing browser data may remove local saves; logging in with your authenticated account restores your cloud profile.
3. **Disaster Recovery:** Offsite JSON export and import capabilities are provided for player convenience. The Operator is not liable for data loss resulting from player-initiated local cache purges or unauthorized save editing.

---

## 6. PRIVACY & COMPLIANCE

1. **Data Collected:** We collect minimal data necessary to provide the Service: verified email addresses, public profile display names, telemetry (map ID, coordinates, soul level, extinction counts), and bug report attachments.
2. **No Data Selling:** We do NOT sell, rent, or trade player personal information or email addresses to third parties or advertising networks.
3. **Account Deletion:** You may disconnect your account and purge locally cached profile tokens at any time via the in-game Account & License menu.

---

## 7. INTELLECTUAL PROPERTY

All title, ownership rights, and intellectual property rights in and to Project SwiftSouls and the Service remain the sole property of David Swift and credited contributors. The Service is protected by copyright laws and international treaties.

---

## 8. TERMINATION & SUSPENSION

We reserve the right to suspend or terminate your access to the Service at our sole discretion, without notice, for conduct that we believe violates these Terms, is harmful to other users, or infringes on intellectual property rights.

---

## 9. DISCLAIMER OF WARRANTIES & LIMITATION OF LIABILITY

THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS. THE OPERATOR DISCLAIMS ALL WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. UNDER NO CIRCUMSTANCES SHALL THE OPERATOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES ARISING OUT OF YOUR USE OF THE SERVICE. TOTAL LIABILITY SHALL NOT EXCEED THE PURCHASE PRICE PAID ($12.99 USD).

---

## 10. MODIFICATIONS TO TERMS

We reserve the right to modify these Terms at any time. Material changes will be indicated by updating the "Last Updated" date at the top of this document. Continued use of the Service after changes constitutes acceptance.

---

## 11. CONTACT

For support, terms inquiries, or account questions:  
* **Administrator:** David Swift  
* **Email:** `davidswift0920@gmail.com`  
* **Project Repository:** Project SwiftSouls  
