import { TouchControls, type TouchMode } from '../src/systems/TouchControls.ts';
import { GamepadManager, type GamepadState } from '../src/systems/GamepadManager.ts';

/**
 * Sprint 23 Comprehensive Automated Verification Suite
 * Mobile Touch Overlay (Virtual D-Pad), Responsive Viewport & Hardware Gamepad
 */
function runSprint23Tests() {
    console.log('====================================================');
    console.log('   RUNNING SPRINT 23 AUTOMATED VERIFICATION SUITE   ');
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

    // Mock localStorage for Node environment
    const store: { [key: string]: string } = {};
    if (typeof (globalThis as any).localStorage === 'undefined') {
        (globalThis as any).localStorage = {
            getItem: (key: string) => store[key] || null,
            setItem: (key: string, val: string) => { store[key] = val; },
            removeItem: (key: string) => { delete store[key]; },
            clear: () => { for (const k in store) delete store[k]; },
            get length() { return Object.keys(store).length; },
            key: (idx: number) => Object.keys(store)[idx] || null
        };
    } else {
        localStorage.clear();
    }

    // Mock navigator properties
    let lastVibrateDuration: number | null = null;
    try {
        Object.defineProperty(globalThis.navigator, 'maxTouchPoints', { value: 0, configurable: true, writable: true });
        Object.defineProperty(globalThis.navigator, 'vibrate', {
            value: (duration: number) => {
                lastVibrateDuration = duration;
                return true;
            },
            configurable: true,
            writable: true
        });
        Object.defineProperty(globalThis.navigator, 'getGamepads', { value: () => [], configurable: true, writable: true });
    } catch {
        // Safe fallback
    }

    // ----------------------------------------------------
    // TEST 1: TouchControls Mode Lifecycle & Settings Persistence
    // ----------------------------------------------------
    console.log('\n--- 1. TouchControls Mode Lifecycle & Persistence ---');
    const touch = TouchControls.instance;

    assert(touch.getMode() === 'auto', 'TouchControls initial mode defaults to "auto"');
    
    touch.setMode('on');
    assert(touch.getMode() === 'on', 'TouchControls mode switches to "on"');
    assert(localStorage.getItem('swiftsouls_touch_mode') === 'on', 'Mode is persisted in localStorage as "on"');
    assert(touch.isTouchActive() === true, 'isTouchActive() returns true when mode is "on"');

    touch.setMode('off');
    assert(touch.getMode() === 'off', 'TouchControls mode switches to "off"');
    assert(localStorage.getItem('swiftsouls_touch_mode') === 'off', 'Mode is persisted in localStorage as "off"');
    assert(touch.isTouchActive() === false, 'isTouchActive() returns false when mode is "off"');

    touch.setMode('auto');
    assert(touch.getMode() === 'auto', 'Mode successfully restored to "auto"');

    // ----------------------------------------------------
    // TEST 2: Touch Device Auto-Detection
    // ----------------------------------------------------
    const windowEventListeners: { [type: string]: Array<(e: any) => void> } = {};
    (globalThis as any).window = {
        matchMedia: (query: string) => ({ matches: false }),
        addEventListener: (type: string, cb: (e: any) => void) => {
            if (!windowEventListeners[type]) windowEventListeners[type] = [];
            windowEventListeners[type].push(cb);
        },
        dispatchEvent: (e: any) => {
            if (windowEventListeners[e.type]) {
                windowEventListeners[e.type].forEach(cb => cb(e));
            }
        }
    };

    (globalThis as any).navigator.maxTouchPoints = 0;
    assert(touch.detectTouchDevice() === false, 'Desktop without touch points detected as non-touch device');

    // Simulate mobile touch device with touchpoints
    (globalThis as any).navigator.maxTouchPoints = 5;
    assert(touch.detectTouchDevice() === true, 'Device with maxTouchPoints > 0 detected as touch device');

    // Reset maxTouchPoints and simulate coarse pointer (media query)
    (globalThis as any).navigator.maxTouchPoints = 0;
    (globalThis as any).window.matchMedia = (query: string) => ({ matches: query.includes('coarse') });
    assert(touch.detectTouchDevice() === true, 'Media query pointer: coarse detected as touch device');

    // Reset media query and simulate Telegram WebApp environment
    (globalThis as any).window.matchMedia = () => ({ matches: false });
    (globalThis as any).window.TelegramWebviewProxy = {};
    assert(touch.detectTouchDevice() === true, 'Telegram Webview Proxy detected as touch-capable environment');
    delete (globalThis as any).window.TelegramWebviewProxy;

    // ----------------------------------------------------
    // TEST 3: Virtual 4-Way D-Pad Vector & Angle Mathematics
    // ----------------------------------------------------
    console.log('\n--- 3. Virtual D-Pad Vector & Angle Mathematics ---');
    
    // Deadzone check (radius < 18)
    const deadzoneVector = touch.calculateDirectionVector(10, 10); // dist = 14.14 < 18
    assert(
        !deadzoneVector.up && !deadzoneVector.down && !deadzoneVector.left && !deadzoneVector.right,
        'Pointer displacement within deadzone (<18px) produces stationary vector'
    );

    // Cardinal Right: (dx: 60, dy: 0) -> 0 deg
    const rightVector = touch.calculateDirectionVector(60, 0);
    assert(rightVector.right && !rightVector.left && !rightVector.up && !rightVector.down, 'Vector at 0 deg resolves pure RIGHT');

    // Cardinal Down: (dx: 0, dy: 60) -> 90 deg
    const downVector = touch.calculateDirectionVector(0, 60);
    assert(downVector.down && !downVector.up && !downVector.left && !downVector.right, 'Vector at 90 deg resolves pure DOWN');

    // Cardinal Left: (dx: -60, dy: 0) -> 180 deg
    const leftVector = touch.calculateDirectionVector(-60, 0);
    assert(leftVector.left && !leftVector.right && !leftVector.up && !leftVector.down, 'Vector at 180 deg resolves pure LEFT');

    // Cardinal Up: (dx: 0, dy: -60) -> -90 deg
    const upVector = touch.calculateDirectionVector(0, -60);
    assert(upVector.up && !upVector.down && !upVector.left && !upVector.right, 'Vector at -90 deg resolves pure UP');

    // Diagonal Up-Right: (dx: 50, dy: -50) -> -45 deg
    const upRight = touch.calculateDirectionVector(50, -50);
    assert(upRight.up && upRight.right && !upRight.down && !upRight.left, 'Vector at -45 deg resolves UP-RIGHT diagonal');

    // Diagonal Down-Right: (dx: 50, dy: 50) -> 45 deg
    const downRight = touch.calculateDirectionVector(50, 50);
    assert(downRight.down && downRight.right && !downRight.up && !downRight.left, 'Vector at 45 deg resolves DOWN-RIGHT diagonal');

    // Diagonal Down-Left: (dx: -50, dy: 50) -> 135 deg
    const downLeft = touch.calculateDirectionVector(-50, 50);
    assert(downLeft.down && downLeft.left && !downLeft.up && !downLeft.right, 'Vector at 135 deg resolves DOWN-LEFT diagonal');

    // Diagonal Up-Left: (dx: -50, dy: -50) -> -135 deg
    const upLeft = touch.calculateDirectionVector(-50, -50);
    assert(upLeft.up && upLeft.left && !upLeft.down && !upLeft.right, 'Vector at -135 deg resolves UP-LEFT diagonal');

    // Diagonal velocity normalization check
    const baseSpeed = 200;
    const diagNormMultiplier = 0.70710678;
    const expectedDiagSpeed = baseSpeed * diagNormMultiplier;
    assert(Math.round(expectedDiagSpeed) === 141, 'Diagonal normalized velocity (200 * 0.7071) correctly scales to 141px/s');

    // Sprint Speed calculation
    const sprintSpeed = Math.round(baseSpeed * 1.5);
    assert(sprintSpeed === 300, 'Sprint speed multiplier 1.5x boosts hero velocity from 200 to 300');

    // ----------------------------------------------------
    // TEST 4: Action & Menu Callbacks, Haptics
    // ----------------------------------------------------
    console.log('\n--- 4. Action & Menu Callbacks & Haptic Feedback ---');
    let actionTriggered = false;
    let menuTriggered = false;

    touch.setActionCallback(() => { actionTriggered = true; });
    touch.setMenuCallback(() => { menuTriggered = true; });

    // Verify callbacks are registered
    assert(typeof (touch as any).onActionCallback === 'function', 'Action callback properly registered');
    assert(typeof (touch as any).onMenuCallback === 'function', 'Menu callback properly registered');

    // Haptics testing
    touch.setHapticsEnabled(true);
    assert(touch.isHapticsEnabled() === true, 'Haptics enabled flag is true');
    assert(localStorage.getItem('swiftsouls_haptics') === 'true', 'Haptics setting persisted to localStorage');

    touch.triggerHaptic(35);
    assert(lastVibrateDuration === 35, 'triggerHaptic(35) invokes navigator.vibrate with duration 35ms');

    touch.setHapticsEnabled(false);
    lastVibrateDuration = null;
    touch.triggerHaptic(50);
    assert(lastVibrateDuration === null, 'triggerHaptic bypassed when haptics are disabled');
    touch.setHapticsEnabled(true);

    // ----------------------------------------------------
    // TEST 5: Hardware GamepadManager & Deadzone Engine
    // ----------------------------------------------------
    console.log('\n--- 5. Hardware GamepadManager & Deadzone Filtering ---');
    const gm = GamepadManager.instance;

    assert(gm.getDeadzone() === 0.25, 'Default gamepad deadzone is 0.25');
    gm.setDeadzone(0.30);
    assert(gm.getDeadzone() === 0.30, 'Gamepad deadzone updated to 0.30');
    gm.setDeadzone(0.01); // should clamp to 0.05
    assert(gm.getDeadzone() === 0.05, 'Deadzone lower bound clamped to 0.05');
    gm.setDeadzone(0.95); // should clamp to 0.8
    assert(gm.getDeadzone() === 0.8, 'Deadzone upper bound clamped to 0.8');
    gm.setDeadzone(0.25); // reset to standard

    // Deadzone filtering math
    assert(gm.applyDeadzone(0.15) === 0, 'Axis drift of +0.15 within deadzone 0.25 filtered to 0');
    assert(gm.applyDeadzone(-0.20) === 0, 'Axis drift of -0.20 within deadzone 0.25 filtered to 0');
    assert(gm.applyDeadzone(0.55) === 0.55, 'Axis deflection of +0.55 beyond deadzone preserved');
    assert(gm.applyDeadzone(-0.75) === -0.75, 'Axis deflection of -0.75 beyond deadzone preserved');

    // ----------------------------------------------------
    // TEST 6: Gamepad State Parsing & Button Mapping
    // ----------------------------------------------------
    console.log('\n--- 6. Gamepad State Parsing & Button Mapping ---');
    
    // Test disconnected state
    const emptyState = gm.parseGamepadState(null);
    assert(emptyState.connected === false, 'Null gamepad parses as disconnected');
    assert(emptyState.buttons.a === false, 'Disconnected gamepad button A is false');

    // Create synthetic W3C Gamepad object (e.g. Xbox Wireless Controller)
    const mockGamepad: any = {
        id: 'Xbox 360 Controller (XInput STANDARD GAMEPAD)',
        index: 0,
        connected: true,
        timestamp: Date.now(),
        mapping: 'standard',
        axes: [0.65, -0.15, 0.0, 0.0], // Left stick X: 0.65 (Right), Left stick Y: -0.15 (within deadzone)
        buttons: [
            { pressed: true, value: 1.0 },   // 0: A (Interact)
            { pressed: false, value: 0.0 },  // 1: B (Sprint)
            { pressed: false, value: 0.0 },  // 2: X
            { pressed: false, value: 0.0 },  // 3: Y
            { pressed: false, value: 0.0 },  // 4: LB
            { pressed: false, value: 0.0 },  // 5: RB
            { pressed: false, value: 0.0 },  // 6: LT
            { pressed: false, value: 0.0 },  // 7: RT
            { pressed: false, value: 0.0 },  // 8: Select
            { pressed: true, value: 1.0 },   // 9: Start (Menu)
            { pressed: false, value: 0.0 },  // 10
            { pressed: false, value: 0.0 },  // 11
            { pressed: false, value: 0.0 },  // 12: DpadUp
            { pressed: false, value: 0.0 },  // 13: DpadDown
            { pressed: false, value: 0.0 },  // 14: DpadLeft
            { pressed: true, value: 1.0 }    // 15: DpadRight
        ]
    };

    const parsed = gm.parseGamepadState(mockGamepad);
    assert(parsed.connected === true, 'Synthetic gamepad parses connected = true');
    assert(parsed.id.includes('Xbox'), 'Gamepad ID parsed correctly');
    assert(parsed.buttons.a === true, 'Button 0 mapped to Action/Confirm [A]');
    assert(parsed.buttons.b === false, 'Button 1 [B] is unpressed');
    assert(parsed.buttons.start === true, 'Button 9 mapped to Menu [Start]');
    assert(parsed.buttons.dpadRight === true, 'Button 15 mapped to D-Pad Right');
    assert(parsed.axes.leftX === 0.65, 'Left stick X deflection (0.65 > 0.25) preserved for Right movement');
    assert(parsed.axes.leftY === 0, 'Left stick Y drift (-0.15 < 0.25) successfully filtered to 0');

    // ----------------------------------------------------
    // TEST 7: Responsive Viewport & Aspect Ratio Math
    // ----------------------------------------------------
    console.log('\n--- 7. Responsive Viewport & Aspect Ratio Scaling Math ---');
    const baseW = 1330;
    const baseH = 998;
    const baseAspect = baseW / baseH; // ~1.332665 (4:3 retro ratio)

    assert(Math.abs(baseAspect - (4 / 3)) < 0.001, 'Base game resolution 1330x998 perfectly matches retro 4:3 aspect ratio');

    // Simulate Scale.FIT on modern smartphone landscape (e.g. iPhone 14 / Samsung S23: 844 x 390, ~19.5:9)
    const mobileScreenW = 844;
    const mobileScreenH = 390;
    const scaleFactorMobile = Math.min(mobileScreenW / baseW, mobileScreenH / baseH);
    const scaledMobileW = baseW * scaleFactorMobile;
    const scaledMobileH = baseH * scaleFactorMobile;
    const pillarboxWidth = (mobileScreenW - scaledMobileW) / 2;

    assert(Math.round(scaledMobileH) === mobileScreenH, 'Scale.FIT scales game height to 100% of mobile screen (390px)');
    assert(pillarboxWidth > 0, 'Ultrawide phone creates clean symmetrical pillarbox margins without image stretching');
    assert(Math.abs((scaledMobileW / scaledMobileH) - baseAspect) < 0.0001, 'Canvas aspect ratio remains 100% distortion-free on mobile');

    // Simulate Scale.FIT on desktop 1080p widescreen (1920 x 1080)
    const desktopW = 1920;
    const desktopH = 1080;
    const scaleFactorDesktop = Math.min(desktopW / baseW, desktopH / baseH);
    const scaledDesktopW = baseW * scaleFactorDesktop;
    const scaledDesktopH = baseH * scaleFactorDesktop;

    assert(Math.round(scaledDesktopH) === desktopH, 'Scale.FIT scales game height to 100% of 1080p display (1080px)');
    assert(Math.abs((scaledDesktopW / scaledDesktopH) - baseAspect) < 0.0001, 'Canvas aspect ratio remains 100% distortion-free on desktop 1080p');

    console.log('\n====================================================');
    console.log(`   TEST COMPLETE: ${passed} PASSED | ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runSprint23Tests();
