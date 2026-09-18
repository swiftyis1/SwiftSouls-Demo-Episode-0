import type Phaser from 'phaser';

export type TouchMode = 'auto' | 'on' | 'off';

export interface TouchState {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    isSprinting: boolean;
}

export interface ActionButtonContext {
    label: string;
    icon?: string;
    fillColor?: number;
    strokeColor?: number;
    textColor?: string;
    pulse?: boolean;
}

export class TouchControls {
    private static _instance: TouchControls;

    private mode: TouchMode = 'auto';
    private hapticsEnabled: boolean = true;
    private sprintToggled: boolean = false;
    private state: TouchState = {
        up: false,
        down: false,
        left: false,
        right: false,
        isSprinting: false
    };

    // Active Phaser GameObjects for current overlay
    private scene: Phaser.Scene | null = null;
    private container: Phaser.GameObjects.Container | null = null;
    private dpadContainer: Phaser.GameObjects.Container | null = null;
    private dpadBase: Phaser.GameObjects.Graphics | null = null;
    private dpadThumb: Phaser.GameObjects.Graphics | null = null;
    private dpadArrows: Phaser.GameObjects.Text[] = [];
    private dpadHitZone: Phaser.GameObjects.Zone | null = null;

    // Action button dynamic elements
    private btnA: Phaser.GameObjects.Container | null = null;
    private btnAGfx: Phaser.GameObjects.Graphics | null = null;
    private btnAIconText: Phaser.GameObjects.Text | null = null;
    private btnALabelText: Phaser.GameObjects.Text | null = null;
    private btnAZone: Phaser.GameObjects.Zone | null = null;
    private btnAPulseTween: Phaser.Tweens.Tween | null = null;
    private currentActionContext: ActionButtonContext | null = null;
    private btnAX: number = 0;
    private btnAY: number = 0;
    private readonly btnARadius: number = 48;

    // Sprint button dynamic elements
    private btnRun: Phaser.GameObjects.Container | null = null;
    private btnRunGfx: Phaser.GameObjects.Graphics | null = null;
    private btnRunIconText: Phaser.GameObjects.Text | null = null;
    private btnRunLabelText: Phaser.GameObjects.Text | null = null;
    private btnRunZone: Phaser.GameObjects.Zone | null = null;
    private btnRunPointerDownTime: number = 0;
    private btnRunX: number = 0;
    private btnRunY: number = 0;
    private readonly btnRunRadius: number = 40;

    // Menu and HUD elements
    private btnMenu: Phaser.GameObjects.Container | null = null;
    private btnMenuZone: Phaser.GameObjects.Zone | null = null;
    private btnMenuX: number = 0;
    private btnMenuY: number = 0;
    private readonly btnMenuRadius: number = 36;
    private hudToggle: Phaser.GameObjects.Container | null = null;
    private hudToggleGfx: Phaser.GameObjects.Graphics | null = null;
    private hudToggleIcon: Phaser.GameObjects.Text | null = null;
    private hudToggleLabel: Phaser.GameObjects.Text | null = null;
    private hudToggleX: number = 0;
    private hudToggleY: number = 0;

    // Center coordinates of the virtual D-Pad in SCREEN space
    private dpadDefaultX: number = 145;
    private dpadDefaultY: number = 840;
    private dpadCenterX: number = 145;
    private dpadCenterY: number = 840;
    private readonly dpadRadius: number = 85;
    private readonly thumbRadius: number = 34;
    private readonly deadzone: number = 16;
    private activePointerId: number | null = null;

    // Region bounds for D-Pad touch capture
    private leftRegionWidth: number = 460;
    private leftRegionHeight: number = 580;

    // Callbacks
    private onActionCallback: (() => void) | null = null;
    private onMenuCallback: (() => void) | null = null;

    private constructor() {
        this.loadSettings();
    }

    public static get instance(): TouchControls {
        if (!TouchControls._instance) {
            TouchControls._instance = new TouchControls();
        }
        return TouchControls._instance;
    }

    private loadSettings() {
        try {
            if (typeof localStorage !== 'undefined') {
                const savedMode = localStorage.getItem('swiftsouls_touch_mode') as TouchMode;
                if (savedMode === 'auto' || savedMode === 'on' || savedMode === 'off') {
                    this.mode = savedMode;
                }
                const savedHaptics = localStorage.getItem('swiftsouls_haptics');
                if (savedHaptics !== null) {
                    this.hapticsEnabled = savedHaptics === 'true';
                }
            }
        } catch {
            // Fallback to defaults
        }
    }

    public saveSettings() {
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem('swiftsouls_touch_mode', this.mode);
                localStorage.setItem('swiftsouls_haptics', this.hapticsEnabled ? 'true' : 'false');
            }
        } catch {
            // LocalStorage write fail protection
        }
    }

    public getMode(): TouchMode {
        return this.mode;
    }

    public setMode(mode: TouchMode) {
        this.mode = mode;
        this.saveSettings();
        this.refreshVisibility();
        this.updateHudToggleVisuals();
    }

    public isHapticsEnabled(): boolean {
        return this.hapticsEnabled;
    }

    public setHapticsEnabled(enabled: boolean) {
        this.hapticsEnabled = enabled;
        this.saveSettings();
    }

    public detectTouchDevice(): boolean {
        if (typeof window === 'undefined') return false;
        const hasTouchEvents = 'ontouchstart' in window;
        const hasMaxTouchPoints = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
        const hasCoarsePointer = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
        const isTelegram = typeof window !== 'undefined' && ((window as any).TelegramWebviewProxy !== undefined || (window as any).Telegram?.WebApp !== undefined);
        return hasTouchEvents || hasMaxTouchPoints || hasCoarsePointer || isTelegram;
    }

    public isTouchActive(): boolean {
        if (this.mode === 'on') return true;
        if (this.mode === 'off') return false;
        return this.detectTouchDevice();
    }

    public getActiveScene(): Phaser.Scene | null {
        return this.scene;
    }

    public getState(): TouchState {
        // Failsafe: verify active pointer is still held down
        if (this.activePointerId !== null && this.scene && this.scene.input) {
            const pointers: (Phaser.Input.Pointer | undefined)[] = (this.scene.input as any).manager?.pointers || [
                this.scene.input.pointer1,
                this.scene.input.pointer2,
                this.scene.input.pointer3,
                this.scene.input.pointer4,
                this.scene.input.pointer5
            ];
            const pointer = pointers.find(p => p && p.id === this.activePointerId);
            if (!pointer || !pointer.isDown) {
                this.reset();
            }
        }
        return this.state;
    }

    public triggerHaptic(durationMs: number = 20) {
        if (!this.hapticsEnabled) return;
        try {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(durationMs);
            }
        } catch {
            // Vibration API fallback
        }
    }

    public setActionCallback(cb: () => void) {
        this.onActionCallback = cb;
    }

    public setMenuCallback(cb: () => void) {
        this.onMenuCallback = cb;
    }

    /**
     * Compute cardinal/diagonal direction from screen-space pointer offset relative to D-Pad center
     */
    public calculateDirectionVector(dx: number, dy: number): { up: boolean; down: boolean; left: boolean; right: boolean } {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.deadzone) {
            return { up: false, down: false, left: false, right: false };
        }

        // Angle in degrees (-180 to 180)
        const angle = Math.atan2(dy, dx);
        const deg = (angle * 180) / Math.PI;

        let up = false;
        let down = false;
        let left = false;
        let right = false;

        // 8-directional sectors (45 deg each)
        if (deg >= -22.5 && deg < 22.5) {
            right = true;
        } else if (deg >= 22.5 && deg < 67.5) {
            down = true;
            right = true;
        } else if (deg >= 67.5 && deg < 112.5) {
            down = true;
        } else if (deg >= 112.5 && deg < 157.5) {
            down = true;
            left = true;
        } else if (deg >= 157.5 || deg < -157.5) {
            left = true;
        } else if (deg >= -157.5 && deg < -112.5) {
            up = true;
            left = true;
        } else if (deg >= -112.5 && deg < -67.5) {
            up = true;
        } else if (deg >= -67.5 && deg < -22.5) {
            up = true;
            right = true;
        }

        return { up, down, left, right };
    }

    /**
     * Create in-scene translucent overlay with floating multi-touch virtual D-Pad and dynamic buttons
     * Works seamlessly regardless of camera scroll on 100x100 world maps or small interiors!
     */
    public createOverlay(scene: Phaser.Scene) {
        this.destroyOverlay();
        this.scene = scene;

        // Multi-Touch Pointer Expansion: Allocate 4 additional pointers (6 total)
        if (scene.input && typeof scene.input.addPointer === 'function') {
            scene.input.addPointer(4);
        }

        const width = scene.cameras.main.width;
        const height = scene.cameras.main.height;

        this.container = scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(1000);

        this.dpadDefaultX = 145;
        this.dpadDefaultY = height - 145;
        this.dpadCenterX = this.dpadDefaultX;
        this.dpadCenterY = this.dpadDefaultY;

        this.leftRegionWidth = Math.min(width * 0.45, 460);
        this.leftRegionHeight = Math.min(height * 0.65, 580);

        // --- 1. D-Pad Container (Base + Arrows + Thumbstick) ---
        this.dpadContainer = scene.add.container(0, 0);
        this.dpadContainer.setScrollFactor(0);
        this.container.add(this.dpadContainer);

        this.dpadBase = scene.add.graphics();
        this.dpadBase.setScrollFactor(0);
        this.dpadContainer.add(this.dpadBase);

        this.dpadArrows = [];
        const arrowDefs = [
            { text: '▲', key: 'up' },
            { text: '▼', key: 'down' },
            { text: '◀', key: 'left' },
            { text: '▶', key: 'right' }
        ];
        arrowDefs.forEach(a => {
            const arrowText = scene.add.text(0, 0, a.text, {
                fontFamily: 'monospace',
                fontSize: '22px',
                color: '#38bdf8'
            });
            arrowText.setOrigin(0.5, 0.5);
            arrowText.setScrollFactor(0);
            this.dpadArrows.push(arrowText);
            this.dpadContainer?.add(arrowText);
        });

        this.dpadThumb = scene.add.graphics();
        this.dpadThumb.setScrollFactor(0);
        this.dpadContainer.add(this.dpadThumb);

        this.redrawDpadComponents();

        // --- 2. Generous Left-Side Touch HitZone for Instant D-Pad Capture ---
        this.dpadHitZone = scene.add.zone(
            this.leftRegionWidth / 2,
            height - this.leftRegionHeight / 2,
            this.leftRegionWidth,
            this.leftRegionHeight
        );
        this.dpadHitZone.setOrigin(0.5, 0.5);
        this.dpadHitZone.setScrollFactor(0);
        this.dpadHitZone.setInteractive();
        this.container.add(this.dpadHitZone);

        // Process D-Pad Pointerdown using Screen-Space Coordinates
        const onDpadPointerDown = (pointer: Phaser.Input.Pointer) => {
            if (!this.isTouchActive()) return;
            if (this.activePointerId !== null) return;

            const screenX = pointer.position ? pointer.position.x : pointer.x;
            const screenY = pointer.position ? pointer.position.y : pointer.y;

            // Check if touch is within left region bounds
            if (screenX <= this.leftRegionWidth && screenY >= height - this.leftRegionHeight) {
                this.activePointerId = pointer.id;

                const minX = this.dpadRadius + 20;
                const maxX = this.leftRegionWidth - this.dpadRadius - 10;
                const minY = height - this.leftRegionHeight + this.dpadRadius + 20;
                const maxY = height - this.dpadRadius - 20;
                this.dpadCenterX = Math.min(Math.max(screenX, minX), maxX);
                this.dpadCenterY = Math.min(Math.max(screenY, minY), maxY);

                this.redrawDpadComponents();
                this.updateDpadPointer(screenX, screenY);
                this.triggerHaptic(15);
            }
        };

        this.dpadHitZone.on('pointerdown', onDpadPointerDown);

        scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!this.isTouchActive()) return;
            const screenX = pointer.position ? pointer.position.x : pointer.x;
            const screenY = pointer.position ? pointer.position.y : pointer.y;

            // 1. Direct Screen-Space Hit Check for D-Pad Left Quadrant
            if (this.activePointerId === null && screenX <= this.leftRegionWidth && screenY >= height - this.leftRegionHeight) {
                onDpadPointerDown(pointer);
                return;
            }

            // 2. Direct Screen-Space Hit Check for Action Button [A]
            const distA = Math.hypot(screenX - this.btnAX, screenY - this.btnAY);
            if (distA <= this.btnARadius * 1.3) {
                this.triggerActionButtonPress();
                return;
            }

            // 3. Direct Screen-Space Hit Check for Sprint Button [RUN]
            const distRun = Math.hypot(screenX - this.btnRunX, screenY - this.btnRunY);
            if (distRun <= this.btnRunRadius * 1.3) {
                this.triggerSprintButtonPress();
                return;
            }

            // 4. Direct Screen-Space Hit Check for Menu Button [MENU]
            const distMenu = Math.hypot(screenX - this.btnMenuX, screenY - this.btnMenuY);
            if (distMenu <= this.btnMenuRadius * 1.3) {
                this.triggerMenuButtonPress();
                return;
            }
        });

        scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.activePointerId === pointer.id) {
                const screenX = pointer.position ? pointer.position.x : pointer.x;
                const screenY = pointer.position ? pointer.position.y : pointer.y;
                this.updateDpadPointer(screenX, screenY);
            }
        });

        const resetDpad = (pointer: Phaser.Input.Pointer) => {
            if (this.activePointerId === pointer.id) {
                this.activePointerId = null;
                this.dpadCenterX = this.dpadDefaultX;
                this.dpadCenterY = this.dpadDefaultY;
                this.redrawDpadComponents();
                this.resetDpadThumb();
            }
        };

        scene.input.on('pointerup', resetDpad);
        scene.input.on('pointerupoutside', resetDpad);

        // --- 3. Dynamic Action Button [A] (Bottom-Right) ---
        this.btnAX = width - 110;
        this.btnAY = height - 130;
        this.btnA = this.createActionButton(scene, this.btnAX, this.btnAY, this.btnARadius, () => {
            this.triggerActionButtonPress();
        });
        this.container.add(this.btnA);

        // --- 4. Dynamic Sprint/Run Button [RUN] (Left of [A]) ---
        this.btnRunX = width - 230;
        this.btnRunY = height - 105;
        this.btnRun = this.createSprintButton(scene, this.btnRunX, this.btnRunY, this.btnRunRadius);
        this.container.add(this.btnRun);

        // --- 5. Menu Button [MENU] (Above [A]) ---
        this.btnMenuX = width - 110;
        this.btnMenuY = height - 245;
        this.btnMenu = this.createMenuButton(scene, this.btnMenuX, this.btnMenuY, this.btnMenuRadius, () => {
            this.triggerMenuButtonPress();
        });
        this.container.add(this.btnMenu);

        // --- 6. HUD Quick Toggle Button [📱] (Middle-Right) ---
        this.hudToggleX = width - 42;
        this.hudToggleY = Math.round(height / 2);
        this.hudToggle = this.createHudToggle(scene, this.hudToggleX, this.hudToggleY);
        this.container.add(this.hudToggle);

        // Apply default initial action button styling
        this.setActionButtonContext({
            label: 'ACTION',
            icon: '⚔️',
            fillColor: 0x0f172a,
            strokeColor: 0x38bdf8,
            textColor: '#ffffff',
            pulse: false
        });

        this.refreshVisibility();
    }

    private triggerActionButtonPress() {
        if (this.btnA) {
            this.btnA.setScale(0.90);
            this.drawActionButtonGraphics(true);
            if (this.scene) {
                this.scene.time.delayedCall(120, () => {
                    this.btnA?.setScale(1.0);
                    this.drawActionButtonGraphics(false);
                });
            }
        }
        this.triggerHaptic(25);
        if (this.onActionCallback) {
            this.onActionCallback();
        }
    }

    private triggerSprintButtonPress() {
        this.sprintToggled = !this.sprintToggled;
        this.state.isSprinting = this.sprintToggled;
        this.updateSprintVisuals(false);
        if (this.btnRun) {
            this.btnRun.setScale(0.90);
            if (this.scene) {
                this.scene.time.delayedCall(120, () => {
                    this.btnRun?.setScale(1.0);
                });
            }
        }
        this.triggerHaptic(20);
    }

    private triggerMenuButtonPress() {
        if (this.btnMenu && this.btnMenu.alpha > 0.5) {
            this.btnMenu.setScale(0.90);
            if (this.scene) {
                this.scene.time.delayedCall(120, () => {
                    this.btnMenu?.setScale(1.0);
                });
            }
            this.triggerHaptic(25);
            if (this.onMenuCallback) {
                this.onMenuCallback();
            }
        }
    }

    public cycleTouchMode(): TouchMode {
        if (this.mode === 'auto') {
            this.setMode('on');
        } else if (this.mode === 'on') {
            this.setMode('off');
        } else {
            this.setMode('auto');
        }

        if (this.scene) {
            let toastDesc = 'AUTO-DETECT';
            if (this.mode === 'on') toastDesc = 'ALWAYS ON';
            if (this.mode === 'off') toastDesc = 'ALWAYS OFF';
            this.showToast(this.scene, `📱 Touch Controls: ${toastDesc}`);
        }

        return this.mode;
    }

    private redrawDpadComponents() {
        if (!this.dpadBase || !this.dpadThumb) return;

        // Redraw base circle
        this.dpadBase.clear();
        this.dpadBase.fillStyle(0x0a0f1d, 0.75);
        this.dpadBase.fillCircle(this.dpadCenterX, this.dpadCenterY, this.dpadRadius);

        this.dpadBase.lineStyle(3, 0x38bdf8, 0.9);
        this.dpadBase.strokeCircle(this.dpadCenterX, this.dpadCenterY, this.dpadRadius);

        this.dpadBase.lineStyle(1.5, 0x0284c7, 0.35);
        this.dpadBase.lineBetween(this.dpadCenterX - this.dpadRadius, this.dpadCenterY, this.dpadCenterX + this.dpadRadius, this.dpadCenterY);
        this.dpadBase.lineBetween(this.dpadCenterX, this.dpadCenterY - this.dpadRadius, this.dpadCenterX, this.dpadCenterY + this.dpadRadius);

        // Reposition arrows
        if (this.dpadArrows.length === 4) {
            const offset = 50;
            this.dpadArrows[0].setPosition(this.dpadCenterX, this.dpadCenterY - offset); // Up
            this.dpadArrows[1].setPosition(this.dpadCenterX, this.dpadCenterY + offset); // Down
            this.dpadArrows[2].setPosition(this.dpadCenterX - offset, this.dpadCenterY); // Left
            this.dpadArrows[3].setPosition(this.dpadCenterX + offset, this.dpadCenterY); // Right
        }

        // Draw thumbstick at center
        this.drawDpadThumb(this.dpadThumb, this.dpadCenterX, this.dpadCenterY, this.thumbRadius);
    }

    private drawDpadThumb(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
        g.clear();
        g.fillStyle(0x38bdf8, 0.85);
        g.fillCircle(x, y, r);
        g.lineStyle(2.5, 0xffffff, 0.95);
        g.strokeCircle(x, y, r);

        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(x, y, 6);
    }

    private updateDpadPointer(screenX: number, screenY: number) {
        const dx = screenX - this.dpadCenterX;
        const dy = screenY - this.dpadCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const maxDist = this.dpadRadius - this.thumbRadius / 2;
        let thumbX = screenX;
        let thumbY = screenY;
        if (dist > maxDist) {
            const ratio = maxDist / dist;
            thumbX = this.dpadCenterX + dx * ratio;
            thumbY = this.dpadCenterY + dy * ratio;
        }

        if (this.dpadThumb) {
            this.drawDpadThumb(this.dpadThumb, thumbX, thumbY, this.thumbRadius);
        }

        const dirs = this.calculateDirectionVector(dx, dy);
        this.state.up = dirs.up;
        this.state.down = dirs.down;
        this.state.left = dirs.left;
        this.state.right = dirs.right;
    }

    public reset(): void {
        this.activePointerId = null;
        this.dpadCenterX = this.dpadDefaultX;
        this.dpadCenterY = this.dpadDefaultY;
        this.redrawDpadComponents();
        this.resetDpadThumb();
    }

    public resetInput(): void {
        this.reset();
    }

    private resetDpadThumb() {
        if (this.dpadThumb) {
            this.drawDpadThumb(this.dpadThumb, this.dpadCenterX, this.dpadCenterY, this.thumbRadius);
        }
        this.state.up = false;
        this.state.down = false;
        this.state.left = false;
        this.state.right = false;
    }

    /**
     * Creates a rich tactile Action Button with dynamic label and icon support
     */
    private createActionButton(
        scene: Phaser.Scene,
        x: number,
        y: number,
        radius: number,
        onTap: () => void
    ): Phaser.GameObjects.Container {
        const btn = scene.add.container(x, y);
        btn.setScrollFactor(0);

        this.btnAGfx = scene.add.graphics();
        this.btnAGfx.setScrollFactor(0);
        btn.add(this.btnAGfx);

        this.btnAIconText = scene.add.text(0, -12, '⚔️', {
            fontSize: '24px',
            align: 'center'
        });
        this.btnAIconText.setOrigin(0.5, 0.5);
        this.btnAIconText.setScrollFactor(0);
        btn.add(this.btnAIconText);

        this.btnALabelText = scene.add.text(0, 16, 'ACTION', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        this.btnALabelText.setOrigin(0.5, 0.5);
        this.btnALabelText.setScrollFactor(0);
        btn.add(this.btnALabelText);

        // Generous 115x115px touch zone
        this.btnAZone = scene.add.zone(0, 0, radius * 2.4, radius * 2.4);
        this.btnAZone.setScrollFactor(0);
        this.btnAZone.setInteractive({ useHandCursor: true });
        btn.add(this.btnAZone);

        this.btnAZone.on('pointerdown', () => {
            btn.setScale(0.92);
            this.drawActionButtonGraphics(true);
            onTap();
        });

        const release = () => {
            btn.setScale(1.0);
            this.drawActionButtonGraphics(false);
        };
        this.btnAZone.on('pointerup', release);
        this.btnAZone.on('pointerout', release);

        return btn;
    }

    private drawActionButtonGraphics(pressed: boolean = false) {
        if (!this.btnAGfx) return;
        const radius = this.btnARadius;
        const ctx = this.currentActionContext || {
            fillColor: 0x0f172a,
            strokeColor: 0x38bdf8
        };

        const fillColor = ctx.fillColor ?? 0x0f172a;
        const strokeColor = ctx.strokeColor ?? 0x38bdf8;

        this.btnAGfx.clear();
        this.btnAGfx.fillStyle(fillColor, pressed ? 0.95 : 0.78);
        this.btnAGfx.fillCircle(0, 0, radius);

        this.btnAGfx.lineStyle(pressed ? 4 : 2.5, strokeColor, 1);
        this.btnAGfx.strokeCircle(0, 0, radius);

        // Accent outer glow ring
        this.btnAGfx.lineStyle(1.5, strokeColor, pressed ? 0.8 : 0.35);
        this.btnAGfx.strokeCircle(0, 0, radius + 4);
    }

    /**
     * Dynamically updates the action button's icon, label, theme color, and pulsing animation
     */
    public setActionButtonContext(context: ActionButtonContext) {
        if (
            this.currentActionContext &&
            this.currentActionContext.label === context.label &&
            this.currentActionContext.icon === context.icon &&
            this.currentActionContext.fillColor === context.fillColor &&
            this.currentActionContext.strokeColor === context.strokeColor &&
            this.currentActionContext.pulse === context.pulse
        ) {
            return; // Avoid redundant redraws
        }

        this.currentActionContext = { ...context };

        if (this.btnAIconText) {
            this.btnAIconText.setText(context.icon || '⚔️');
        }

        if (this.btnALabelText) {
            this.btnALabelText.setText(context.label);
            if (context.textColor) {
                this.btnALabelText.setColor(context.textColor);
            }
            if (context.label.length > 5) {
                this.btnALabelText.setFontSize('11px');
            } else {
                this.btnALabelText.setFontSize('13px');
            }
        }

        this.drawActionButtonGraphics(false);

        // Pulse animation when context is active
        if (this.btnA && this.scene) {
            if (this.btnAPulseTween) {
                this.btnAPulseTween.destroy();
                this.btnAPulseTween = null;
            }

            if (context.pulse) {
                this.btnAPulseTween = this.scene.tweens.add({
                    targets: this.btnA,
                    scale: { from: 1.0, to: 1.07 },
                    duration: 650,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
            } else {
                this.btnA.setScale(1.0);
            }
        }
    }

    /**
     * Creates a dual-mode Sprint Button (Tap to toggle Sprint ON/OFF, or Hold to sprint)
     */
    private createSprintButton(
        scene: Phaser.Scene,
        x: number,
        y: number,
        radius: number
    ): Phaser.GameObjects.Container {
        const btn = scene.add.container(x, y);
        btn.setScrollFactor(0);

        this.btnRunGfx = scene.add.graphics();
        this.btnRunGfx.setScrollFactor(0);
        btn.add(this.btnRunGfx);

        this.btnRunIconText = scene.add.text(0, -10, '🏃', {
            fontSize: '22px',
            align: 'center'
        });
        this.btnRunIconText.setOrigin(0.5, 0.5);
        this.btnRunIconText.setScrollFactor(0);
        btn.add(this.btnRunIconText);

        this.btnRunLabelText = scene.add.text(0, 14, 'RUN', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        this.btnRunLabelText.setOrigin(0.5, 0.5);
        this.btnRunLabelText.setScrollFactor(0);
        btn.add(this.btnRunLabelText);

        // Generous 100x100px touch zone
        this.btnRunZone = scene.add.zone(0, 0, radius * 2.4, radius * 2.4);
        this.btnRunZone.setScrollFactor(0);
        this.btnRunZone.setInteractive({ useHandCursor: true });
        btn.add(this.btnRunZone);

        this.updateSprintVisuals(false);

        this.btnRunZone.on('pointerdown', () => {
            this.btnRunPointerDownTime = Date.now();
            this.state.isSprinting = true;
            this.updateSprintVisuals(true);
            btn.setScale(0.92);
            this.triggerHaptic(20);
        });

        const release = () => {
            const elapsed = Date.now() - this.btnRunPointerDownTime;
            // Short tap (< 320ms) toggles persistent sprint
            if (elapsed < 320) {
                this.sprintToggled = !this.sprintToggled;
            }
            this.state.isSprinting = this.sprintToggled;
            this.updateSprintVisuals(false);
            btn.setScale(1.0);
        };

        this.btnRunZone.on('pointerup', release);
        this.btnRunZone.on('pointerout', release);

        return btn;
    }

    private updateSprintVisuals(pressed: boolean = false) {
        if (!this.btnRunGfx || !this.btnRunIconText || !this.btnRunLabelText) return;
        const radius = this.btnRunRadius;
        const isSprinting = this.state.isSprinting || this.sprintToggled;

        const fillColor = isSprinting ? 0xd97706 : 0x0f172a;
        const strokeColor = isSprinting ? 0xfef08a : 0xf59e0b;

        this.btnRunGfx.clear();
        this.btnRunGfx.fillStyle(fillColor, pressed ? 0.95 : (isSprinting ? 0.88 : 0.72));
        this.btnRunGfx.fillCircle(0, 0, radius);

        this.btnRunGfx.lineStyle(pressed || isSprinting ? 3.5 : 2, strokeColor, 1);
        this.btnRunGfx.strokeCircle(0, 0, radius);

        if (isSprinting) {
            this.btnRunGfx.lineStyle(1.5, 0xfde047, 0.6);
            this.btnRunGfx.strokeCircle(0, 0, radius + 3);
            this.btnRunIconText.setText('⚡');
            this.btnRunLabelText.setText('SPRINT');
            this.btnRunLabelText.setColor('#fef08a');
        } else {
            this.btnRunIconText.setText('🏃');
            this.btnRunLabelText.setText('RUN');
            this.btnRunLabelText.setColor('#ffffff');
        }
    }

    /**
     * Creates a Pause/Inventory Menu Button with clean haptics and touch zone
     */
    private createMenuButton(
        scene: Phaser.Scene,
        x: number,
        y: number,
        radius: number,
        onTap: () => void
    ): Phaser.GameObjects.Container {
        const btn = scene.add.container(x, y);
        btn.setScrollFactor(0);

        const g = scene.add.graphics();
        g.setScrollFactor(0);
        const drawBtn = (pressed: boolean) => {
            g.clear();
            g.fillStyle(0x312e81, pressed ? 0.95 : 0.75);
            g.fillCircle(0, 0, radius);
            g.lineStyle(pressed ? 3.5 : 2, 0x818cf8, 1);
            g.strokeCircle(0, 0, radius);
        };
        drawBtn(false);
        btn.add(g);

        const icon = scene.add.text(0, -9, '🎒', {
            fontSize: '20px',
            align: 'center'
        });
        icon.setOrigin(0.5, 0.5);
        icon.setScrollFactor(0);
        btn.add(icon);

        const txt = scene.add.text(0, 13, 'MENU', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            color: '#c7d2fe',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
            align: 'center'
        });
        txt.setOrigin(0.5, 0.5);
        txt.setScrollFactor(0);
        btn.add(txt);

        this.btnMenuZone = scene.add.zone(0, 0, radius * 2.4, radius * 2.4);
        this.btnMenuZone.setScrollFactor(0);
        this.btnMenuZone.setInteractive({ useHandCursor: true });
        btn.add(this.btnMenuZone);

        this.btnMenuZone.on('pointerdown', () => {
            drawBtn(true);
            btn.setScale(0.92);
            onTap();
        });

        const release = () => {
            drawBtn(false);
            btn.setScale(1.0);
        };
        this.btnMenuZone.on('pointerup', release);
        this.btnMenuZone.on('pointerout', release);

        return btn;
    }

    /**
     * Dim/disable Menu button during active dialogue to prevent accidental inventory overlays
     */
    public setMenuDimmed(dimmed: boolean) {
        if (!this.btnMenu) return;
        this.btnMenu.setAlpha(dimmed ? 0.3 : 1.0);
        if (this.btnMenuZone) {
            if (dimmed) {
                this.btnMenuZone.disableInteractive();
            } else {
                this.btnMenuZone.setInteractive({ useHandCursor: true });
            }
        }
    }

    private createHudToggle(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
        const toggle = scene.add.container(x, y);
        toggle.setScrollFactor(0);

        this.hudToggleGfx = scene.add.graphics();
        this.hudToggleGfx.setScrollFactor(0);
        toggle.add(this.hudToggleGfx);

        this.hudToggleIcon = scene.add.text(0, -9, '📱', {
            fontSize: '20px',
            align: 'center'
        });
        this.hudToggleIcon.setOrigin(0.5, 0.5);
        this.hudToggleIcon.setScrollFactor(0);
        toggle.add(this.hudToggleIcon);

        this.hudToggleLabel = scene.add.text(0, 13, this.mode.toUpperCase(), {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#38bdf8',
            align: 'center'
        });
        this.hudToggleLabel.setOrigin(0.5, 0.5);
        this.hudToggleLabel.setScrollFactor(0);
        toggle.add(this.hudToggleLabel);

        const zone = scene.add.zone(0, 0, 58, 58);
        zone.setScrollFactor(0);
        zone.setInteractive({ useHandCursor: true });
        toggle.add(zone);

        zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            pointer.event?.stopPropagation?.();
            this.updateHudToggleVisuals(true);
            toggle.setScale(0.92);
            this.triggerHaptic(20);
            this.cycleTouchMode();
        });

        const release = () => {
            toggle.setScale(1.0);
            this.updateHudToggleVisuals(false);
        };
        zone.on('pointerup', release);
        zone.on('pointerout', release);

        this.updateHudToggleVisuals(false);

        return toggle;
    }

    public updateHudToggleVisuals(pressed: boolean = false) {
        if (!this.hudToggleGfx || !this.hudToggleLabel || !this.hudToggleIcon) return;

        this.hudToggleGfx.clear();

        let fillColor = 0x0f172a;
        let strokeColor = 0x38bdf8;
        let textColor = '#38bdf8';
        let labelText = 'AUTO';
        let iconText = '📱';

        if (this.mode === 'on') {
            fillColor = 0x064e3b;
            strokeColor = 0x22c55e;
            textColor = '#4ade80';
            labelText = 'ON';
            iconText = '📱';
        } else if (this.mode === 'off') {
            fillColor = 0x450a0a;
            strokeColor = 0xef4444;
            textColor = '#f87171';
            labelText = 'OFF';
            iconText = '📱';
        } else {
            fillColor = 0x0f172a;
            strokeColor = 0x38bdf8;
            textColor = '#38bdf8';
            labelText = 'AUTO';
            iconText = '📱';
        }

        const alpha = pressed ? 0.95 : 0.85;
        this.hudToggleGfx.fillStyle(fillColor, alpha);
        this.hudToggleGfx.fillRoundedRect(-27, -27, 54, 54, 10);
        this.hudToggleGfx.lineStyle(2, strokeColor, 0.95);
        this.hudToggleGfx.strokeRoundedRect(-27, -27, 54, 54, 10);

        this.hudToggleIcon.setText(iconText);
        this.hudToggleLabel.setText(labelText);
        this.hudToggleLabel.setColor(textColor);
    }

    private showToast(scene: Phaser.Scene, message: string) {
        const toast = scene.add.text(scene.cameras.main.width / 2, 70, message, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#38bdf8',
            backgroundColor: '#0f172add',
            padding: { x: 16, y: 8 }
        });
        toast.setOrigin(0.5, 0.5);
        toast.setScrollFactor(0);
        toast.setDepth(1500);

        scene.tweens.add({
            targets: toast,
            alpha: 0,
            y: 45,
            duration: 1800,
            ease: 'Power2',
            onComplete: () => toast.destroy()
        });
    }

    public refreshVisibility() {
        if (!this.container) return;
        const active = this.isTouchActive();

        if (this.dpadContainer) this.dpadContainer.setVisible(active);
        if (this.dpadHitZone) this.dpadHitZone.setVisible(active);
        if (this.btnA) this.btnA.setVisible(active);
        if (this.btnRun) this.btnRun.setVisible(active);
        if (this.btnMenu) this.btnMenu.setVisible(active);

        if (this.container && this.container.list) {
            this.container.list.forEach((obj: any) => {
                if (obj !== this.hudToggle) {
                    obj.setVisible(active);
                }
            });
        }

        if (this.hudToggle) {
            this.hudToggle.setVisible(true);
        }
    }

    public destroyOverlay() {
        if (this.btnAPulseTween) {
            this.btnAPulseTween.destroy();
            this.btnAPulseTween = null;
        }
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.dpadContainer = null;
        this.dpadBase = null;
        this.dpadThumb = null;
        this.dpadArrows = [];
        this.dpadHitZone = null;
        this.btnA = null;
        this.btnAGfx = null;
        this.btnAIconText = null;
        this.btnALabelText = null;
        this.btnAZone = null;
        this.btnRun = null;
        this.btnRunGfx = null;
        this.btnRunIconText = null;
        this.btnRunLabelText = null;
        this.btnRunZone = null;
        this.btnMenu = null;
        this.btnMenuZone = null;
        this.hudToggle = null;
        this.hudToggleGfx = null;
        this.hudToggleIcon = null;
        this.hudToggleLabel = null;
        this.scene = null;
        this.activePointerId = null;
        this.currentActionContext = null;
        this.resetDpadThumb();
    }
}
