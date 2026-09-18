import { UserAuthManager } from '../src/systems/UserAuthManager.ts';
import { LicenseManager } from '../src/systems/LicenseManager.ts';
import { LiveOpsManager } from '../src/systems/LiveOpsManager.ts';
import { GameManager } from '../src/systems/GameManager.ts';

/**
 * Sprint 21 Comprehensive Automated Verification Test Suite
 */
function runSprint21Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 21 AUTOMATED VERIFICATION SUITE   ');
    console.log('====================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, desc: string) {
        if (condition) {
            console.log(`  [PASS] ${desc}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${desc}`);
            failed++;
        }
    }

    // Mock localStorage for Node.js test environment if not present
    if (typeof (globalThis as any).localStorage === 'undefined') {
        const store: { [key: string]: string } = {};
        (globalThis as any).localStorage = {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, val: string) => { store[key] = val; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const k in store) delete store[k]; },
            get length() { return Object.keys(store).length; },
            key: (idx: number) => Object.keys(store)[idx] || null
        };
    }

    localStorage.clear();

    // ----------------------------------------------------
    // TEST 1: Google Zero-Password Admin Authorization
    // ----------------------------------------------------
    console.log('\n--- 1. Google OAuth & Zero-Password Admin Rights ---');
    const adminSign = UserAuthManager.instance.signInWithGoogle({
        email: 'davidswift0920@gmail.com',
        displayName: 'David Swift'
    });
    assert(adminSign.success === true, 'Sign in with Google succeeds');
    assert(adminSign.isAdmin === true, 'davidswift0920@gmail.com automatically granted isAdmin = true');
    assert(adminSign.profile.verified === true, 'Google account is pre-verified by OAuth');
    assert(UserAuthManager.instance.isAdmin() === true, 'UserAuthManager.isAdmin() returns true');
    assert(LiveOpsManager.instance.isAuthorizedAdmin() === true, 'LiveOpsManager authorizes admin without secondary password');

    // ----------------------------------------------------
    // TEST 2: Unauthorized User Lockout
    // ----------------------------------------------------
    console.log('\n--- 2. Unauthorized User Lockout ---');
    const playerSign = UserAuthManager.instance.signInWithGoogle({
        email: 'randomplayer@gmail.com',
        displayName: 'Casual Player'
    });
    assert(playerSign.isAdmin === false, 'Standard player is NOT granted admin');
    assert(UserAuthManager.instance.isAdmin() === false, 'UserAuthManager.isAdmin() is false for standard user');

    // ----------------------------------------------------
    // TEST 3: 6-Digit Email OTP Verification Engine
    // ----------------------------------------------------
    console.log('\n--- 3. 6-Digit Email OTP Engine ---');
    const otpReq = UserAuthManager.instance.requestEmailVerificationCode('testuser@example.com');
    assert(otpReq.success === true, 'OTP request succeeds for valid email');
    assert(typeof otpReq.devCode === 'string' && otpReq.devCode.length === 6, 'Generates 6-digit devCode');

    // Test 60-second cooldown
    const cooldownReq = UserAuthManager.instance.requestEmailVerificationCode('testuser@example.com');
    assert(cooldownReq.success === false, '60-second cooldown rejects immediate resend');

    // Test invalid code
    const invalidVer = UserAuthManager.instance.verifyEmailCode('testuser@example.com', '000000');
    assert(invalidVer.success === false, 'Rejects invalid OTP code');

    // Test valid code
    const validVer = UserAuthManager.instance.verifyEmailCode('testuser@example.com', otpReq.devCode!);
    assert(validVer.success === true, 'Valid OTP code completes verification');
    assert(validVer.profile?.verified === true, 'Profile marked verified = true');

    // ----------------------------------------------------
    // TEST 4: Smart Save Slot Allocation & Save Isolation Invariant
    // ----------------------------------------------------
    console.log('\n--- 4. Smart Save Slot Allocation & Zero Merging ---');
    localStorage.clear();

    const emptyStatus = UserAuthManager.instance.getSlotAllocationStatus();
    assert(emptyStatus.hasOpenSlot === true, 'Detects open slot when slots are empty');
    assert(emptyStatus.nextOpenSlot === 1, 'First open slot is Slot 1');

    // Fill Slot 1, Slot 2, Slot 3 with mock data
    localStorage.setItem('swiftsouls_save_1', JSON.stringify({ version: 2, payload: JSON.stringify({ party: [{ name: 'Hero1', level: 2 }] }) }));
    localStorage.setItem('swiftsouls_save_2', JSON.stringify({ version: 2, payload: JSON.stringify({ party: [{ name: 'Hero2', level: 4 }] }) }));
    localStorage.setItem('swiftsouls_save_3', JSON.stringify({ version: 2, payload: JSON.stringify({ party: [{ name: 'Hero3', level: 6 }] }) }));

    const fullStatus = UserAuthManager.instance.getSlotAllocationStatus();
    assert(fullStatus.hasOpenSlot === false, 'Correctly flags all slots full when 1, 2, and 3 are occupied');
    assert(fullStatus.occupiedSlots.length === 3, 'Lists exactly 3 occupied slots');
    assert(fullStatus.occupiedSlots[0].name === 'Hero1', 'Slot 1 preview name preserved');
    assert(fullStatus.occupiedSlots[2].level === 6, 'Slot 3 preview level preserved');

    // Allocate guest progress to Slot 2
    const guestPayload = JSON.stringify({ party: [{ name: 'GuestHero', level: 1 }], soulCrystals: { goblin: { fragments: 10 } } });
    const allocResult = UserAuthManager.instance.allocateGuestProgressToSlot(2, guestPayload);
    assert(allocResult === true, 'Cleanly writes guest session to chosen Slot 2');

    // Verify Slot 1 and Slot 3 are completely untouched (Strict Save Isolation Invariant)
    const slot1Raw = localStorage.getItem('swiftsouls_save_1')!;
    const slot3Raw = localStorage.getItem('swiftsouls_save_3')!;
    assert(slot1Raw.includes('Hero1'), 'Slot 1 untouched and uncorrupted');
    assert(slot3Raw.includes('Hero3'), 'Slot 3 untouched and uncorrupted');

    // ----------------------------------------------------
    // TEST 5: Dual-Checkout & Commercial Upgrade
    // ----------------------------------------------------
    console.log('\n--- 5. Dual-Checkout Payment & Commercial Tier ---');
    const checkoutInfo = LicenseManager.instance.initiatePurchase();
    assert(checkoutInfo.rail === 'stripe', 'Web environment selects Stripe Checkout rail');
    assert(checkoutInfo.checkoutUrl?.includes('buy.stripe.com') === true, 'Stripe checkout URL constructed');

    const upgraded = LicenseManager.instance.upgradeToCommercial({
        paymentRail: 'stripe',
        bondedEmail: 'davidswift0920@gmail.com'
    });
    assert(upgraded.tier === 'commercial', 'License elevated to commercial');
    assert(LicenseManager.instance.isCommercial() === true, 'LicenseManager.isCommercial() returns true');
    assert(LicenseManager.instance.getTimeRemainingFormatted() === 'UNLIMITED', 'Playtime limit removed');
    assert(LicenseManager.instance.isMapAllowed('catacombs') === true, 'Catacombs boundary gate unlocked');
    assert(LicenseManager.instance.isMapAllowed('castle') === true, 'Castle boundary gate unlocked');

    // ----------------------------------------------------
    // TEST 6: Isolated Premium Vault & Cross-Device Re-hydration
    // ----------------------------------------------------
    console.log('\n--- 6. Isolated Premium Vault & Cross-Device Hydration ---');
    assert(LiveOpsManager.instance.hasCommercialRecord('davidswift0920@gmail.com') === true, 'Vault contains record for paid email');

    // Wipe local license record (simulating clearing cookies or new device)
    localStorage.removeItem('swiftsouls_license_record');
    assert(localStorage.getItem('swiftsouls_license_record') === null, 'Local license record wiped');

    // Signing in with the bonded email must auto-restore commercial status
    UserAuthManager.instance.signInWithGoogle({ email: 'davidswift0920@gmail.com' });
    LicenseManager.instance.checkPremiumVaultBonding();
    assert(LicenseManager.instance.isCommercial() === true, 'Commercial Tier re-hydrated from Premium Vault without paying again');

    // ----------------------------------------------------
    // TEST 7: 12-Character Offline Recovery Token
    // ----------------------------------------------------
    console.log('\n--- 7. 12-Character Offline Recovery Token ---');
    const token = LicenseManager.instance.generateRecoveryToken();
    assert(token.startsWith('SWIFT-'), 'Recovery token starts with SWIFT- prefix');
    assert(token.length === 15, 'Recovery token length is 15 characters (SWIFT-XXXX-XXXX)');
    assert(LicenseManager.instance.validateRecoveryToken(token) === true, 'validateRecoveryToken returns true for valid token');
    assert(LicenseManager.instance.validateRecoveryToken('INVALID-TOKEN') === false, 'Rejects invalid token format');

    // Revoke license then redeem token
    LicenseManager.instance.revokeCommercial();
    assert(LicenseManager.instance.isEvaluation() === true, 'License revoked to evaluation');
    const redeemRes = LicenseManager.instance.redeemRecoveryToken(token);
    assert(redeemRes.success === true, 'Token redemption succeeds');
    assert(LicenseManager.instance.isCommercial() === true, 'Commercial Tier restored via recovery token');

    // ----------------------------------------------------
    // TEST 8: Evaluation Demo Timer & 50 Fragment Cap
    // ----------------------------------------------------
    console.log('\n--- 8. Evaluation Demo Timer & 50 Fragment Cap ---');
    UserAuthManager.instance.disconnectAccount();
    LicenseManager.instance.revokeCommercial();
    assert(LicenseManager.instance.isEvaluation() === true, 'License is in evaluation tier');

    // Reset game and harvest fragments
    GameManager.instance.resetGame();
    // Try adding fragments exceeding cap
    const cap = LicenseManager.EVALUATION_FRAGMENT_CAP;
    const fragResult = GameManager.instance.addSoulFragments('goblin', cap + 10);
    assert(fragResult.total === cap, `Fragments capped at ${cap} in Evaluation Tier (actual: ${fragResult.total})`);

    const secondAdd = GameManager.instance.addSoulFragments('goblin', 10);
    assert(secondAdd.added === 0 && secondAdd.total === cap, 'Further harvesting blocked at fragment boundary');

    // ----------------------------------------------------
    // TEST 9: 24-Hour Automated Rolling Backup Engine
    // ----------------------------------------------------
    console.log('\n--- 9. 24-Hour Automated Rolling Backups ---');
    const backupRan = LiveOpsManager.instance.createDailyBackupSnapshot();
    assert(backupRan === true, 'Daily backup snapshot created successfully');
    const backupsList = LiveOpsManager.instance.getBackupsList();
    assert(backupsList.length >= 1, 'Backups list contains created snapshot');
    assert(backupsList[0].key.startsWith('swiftsouls_backup_'), 'Backup key follows naming format');

    // ----------------------------------------------------
    // TEST 10: Offsite Disaster Recovery Bundle & File Restore
    // ----------------------------------------------------
    console.log('\n--- 10. Disaster Recovery JSON Bundle & Restore ---');
    const bundle = LiveOpsManager.instance.generateDisasterRecoveryBundle();
    assert(bundle.includes('swiftsouls_'), 'Bundle contains exported database keys');
    const restoreRes = LiveOpsManager.instance.restoreDisasterRecoveryBundle(bundle);
    assert(restoreRes.success === true, 'Disaster Recovery bundle restores cleanly');

    // ----------------------------------------------------
    // TEST 11: High-Fidelity Bug Reporting Engine
    // ----------------------------------------------------
    console.log('\n--- 11. Bug Reporting Engine & Rate Limiting ---');
    const bugRes = LiveOpsManager.instance.submitBugReport({
        playerEmail: 'player@example.com',
        mapId: 'world_map',
        coordinates: { x: 200, y: 300 },
        soulLevel: 3,
        equipment: { sword: 'goblin', shield: null, armor: null, helmet: null, ring1: null, ring2: null, amulet: null },
        description: 'Collision glitch at the eastern mountain ridge.',
        thumbnailBase64: 'data:image/jpeg;base64,/9j/mock'
    });
    assert(bugRes.success === true, 'Bug report submitted successfully');
    assert(LiveOpsManager.instance.getUnreadBugCount() >= 1, 'Unread bug counter incremented');

    // Rate limiting test
    const spamBug = LiveOpsManager.instance.submitBugReport({
        mapId: 'world_map',
        coordinates: { x: 200, y: 300 },
        soulLevel: 3,
        equipment: { sword: null, shield: null, armor: null, helmet: null, ring1: null, ring2: null, amulet: null },
        description: 'Second immediate submission attempt'
    });
    assert(spamBug.success === false, '60-second rate limiter blocked spam bug submission');

    // ----------------------------------------------------
    // TEST 12: CSV Data Export Generation
    // ----------------------------------------------------
    console.log('\n--- 12. CSV Data Export Generators ---');
    const usersCSV = LiveOpsManager.instance.getUsersCSV();
    assert(usersCSV.includes('Email') && usersCSV.includes('License Tier'), 'Users CSV contains correct header columns');

    const bugsCSV = LiveOpsManager.instance.getBugReportsCSV();
    assert(bugsCSV.includes('ID') && bugsCSV.includes('Description'), 'Bugs CSV contains correct header columns');

    const vaultCSV = LiveOpsManager.instance.getPremiumVaultCSV();
    assert(vaultCSV.includes('Recovery Token'), 'Vault CSV contains recovery token column');

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`SPRINT 21 SUITE COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint21Tests();
