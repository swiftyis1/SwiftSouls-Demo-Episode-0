import type Phaser from 'phaser';

export type TouchMode = 'auto' | 'on' | 'off';

export interface TouchState {
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    isSprinting: boolean;
}

export class TouchControls {
    private static _instance: TouchControls;

    private mode: TouchMode = 'auto';
    private hapticsEnabled: boolean = true;
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
    private dpadBase: Phaser.GameObjects.Graphics | null = null;
    private dpadThumb: Phaser.GameObjects.Graphics | null = null;
    private btnA: Phaser.GameObjects.Container | null = null;
    private btnRun: Phaser.GameObjects.Container | null = null;
    private btnMenu: Phaser.GameObjects.Container | null = null;
    private hudToggle: Phaser.GameObjects.Container | null = null;

    // Center coordinates of the virtual D-Pad
    private dpadCenterX: number = 160;
    private dpadCenterY: number = 840;
    private readonly dpadRadius: number = 90;
    private readonly thumbRadius: number = 34;
    private readonly deadzone: number = 18;
    private activePointerId: number | null = null;

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
     * Compute cardinal/diagonal direction from pointer offset relative to D-Pad center
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

        // 8-directional sectors
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
     * Create in-scene translucent overlay
     */
    public createOverlay(scene: Phaser.Scene) {
        this.destroyOverlay();
        this.scene = scene;

        const width = scene.cameras.main.width;
        const height = scene.cameras.main.height;

        this.container = scene.add.container(0, 0);
        this.container.setScrollFactor(0);
        this.container.setDepth(1000);

        this.dpadCenterX = 150;
        this.dpadCenterY = height - 150;

        // 1. D-Pad Base Graphic
        this.dpadBase = scene.add.graphics();
        this.drawDpadBase(this.dpadBase, this.dpadCenterX, this.dpadCenterY, this.dpadRadius);
        this.container.add(this.dpadBase);

        // 2. D-Pad Direction Arrows
        const arrows = [
            { text: '▲', x: this.dpadCenterX, y: this.dpadCenterY - 50 },
            { text: '▼', x: this.dpadCenterX, y: this.dpadCenterY + 50 },
            { text: '◀', x: this.dpadCenterX - 50, y: this.dpadCenterY },
            { text: '▶', x: this.dpadCenterX + 50, y: this.dpadCenterY }
        ];
        arrows.forEach(a => {
            const arrowText = scene.add.text(a.x, a.y, a.text, {
                fontFamily: 'monospace',
                fontSize: '24px',
                color: '#38bdf8'
            });
            arrowText.setOrigin(0.5, 0.5);
            this.container?.add(arrowText);
        });

        // 3. D-Pad Thumbstick
        this.dpadThumb = scene.add.graphics();
        this.drawDpadThumb(this.dpadThumb, this.dpadCenterX, this.dpadCenterY, this.thumbRadius);
        this.container.add(this.dpadThumb);

        // Make D-Pad zone interactive
        const hitZone = scene.add.zone(this.dpadCenterX, this.dpadCenterY, this.dpadRadius * 2.4, this.dpadRadius * 2.4);
        hitZone.setOrigin(0.5, 0.5);
        hitZone.setInteractive();
        this.container.add(hitZone);

        hitZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.activePointerId = pointer.id;
            this.updateDpadPointer(pointer.x, pointer.y);
            this.triggerHaptic(15);
        });

        scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.activePointerId === pointer.id) {
                this.updateDpadPointer(pointer.x, pointer.y);
            }
        });

        const resetDpad = (pointer: Phaser.Input.Pointer) => {
            if (this.activePointerId === pointer.id) {
                this.activePointerId = null;
                this.resetDpadThumb();
            }
        };

        scene.input.on('pointerup', resetDpad);
        scene.input.on('pointerupoutside', resetDpad);

        // 4. Action Button [A] (Bottom-Right)
        const btnAX = width - 110;
        const btnAY = height - 130;
        this.btnA = this.createActionButton(scene, btnAX, btnAY, 44, 'A', 0x10b981, 0x34d399, () => {
            this.triggerHaptic(25);
            if (this.onActionCallback) {
                this.onActionCallback();
            }
        });
        this.container.add(this.btnA);

        // 5. Sprint/Run Button [RUN] (Left of [A])
        const btnRunX = width - 210;
        const btnRunY = height - 100;
        this.btnRun = this.createHoldButton(scene, btnRunX, btnRunY, 36, 'RUN', 0xf59e0b, 0xfbbf24, (isHeld) => {
            this.state.isSprinting = isHeld;
            if (isHeld) this.triggerHaptic(20);
        });
        this.container.add(this.btnRun);

        // 6. Menu Button [MENU] (Above [A])
        const btnMenuX = width - 110;
        const btnMenuY = height - 230;
        this.btnMenu = this.createActionButton(scene, btnMenuX, btnMenuY, 36, 'MENU', 0x6366f1, 0x818cf8, () => {
            this.triggerHaptic(25);
            if (this.onMenuCallback) {
                this.onMenuCallback();
            }
        });
        this.container.add(this.btnMenu);

        // 7. HUD Quick Toggle Button [📱] (Top-Right)
        this.hudToggle = this.createHudToggle(scene, width - 45, 45);
        this.container.add(this.hudToggle);

        this.refreshVisibility();
    }

    private drawDpadBase(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
        g.clear();
        g.fillStyle(0x0f172a, 0.65);
        g.fillCircle(x, y, r);

        g.lineStyle(3, 0x38bdf8, 0.85);
        g.strokeCircle(x, y, r);

        g.lineStyle(1.5, 0x0284c7, 0.3);
        g.lineBetween(x - r, y, x + r, y);
        g.lineBetween(x, y - r, x, y + r);
    }

    private drawDpadThumb(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number) {
        g.clear();
        g.fillStyle(0x38bdf8, 0.75);
        g.fillCircle(x, y, r);
        g.lineStyle(2.5, 0xffffff, 0.95);
        g.strokeCircle(x, y, r);

        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(x, y, 5);
    }

    private updateDpadPointer(pointerX: number, pointerY: number) {
        let dx = pointerX - this.dpadCenterX;
        let dy = pointerY - this.dpadCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const maxDist = this.dpadRadius - this.thumbRadius / 2;
        let thumbX = pointerX;
        let thumbY = pointerY;
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
        this.resetDpadThumb();
        this.state.isSprinting = false;
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

    private createActionButton(
        scene: Phaser.Scene,
        x: number,
        y: number,
        radius: number,
        label: string,
        fillColor: number,
        strokeColor: number,
        onTap: () => void
    ): Phaser.GameObjects.Container {
        const btn = scene.add.container(x, y);

        const g = scene.add.graphics();
        const drawBtn = (pressed: boolean) => {
            g.clear();
            g.fillStyle(fillColor, pressed ? 0.9 : 0.65);
            g.fillCircle(0, 0, radius);
            g.lineStyle(pressed ? 4 : 2.5, strokeColor, 1);
            g.strokeCircle(0, 0, radius);
        };
        drawBtn(false);
        btn.add(g);

        const txt = scene.add.text(0, 0, label, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: label.length > 2 ? '18px' : '26px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        txt.setOrigin(0.5, 0.5);
        btn.add(txt);

        const zone = scene.add.zone(0, 0, radius * 2, radius * 2);
        zone.setInteractive({ useHandCursor: true });
        btn.add(zone);

        zone.on('pointerdown', () => {
            drawBtn(true);
            btn.setScale(0.94);
            onTap();
        });

        const release = () => {
            drawBtn(false);
            btn.setScale(1.0);
        };
        zone.on('pointerup', release);
        zone.on('pointerout', release);

        return btn;
    }

    private createHoldButton(
        scene: Phaser.Scene,
        x: number,
        y: number,
        radius: number,
        label: string,
        fillColor: number,
        strokeColor: number,
        onHoldChange: (isHeld: boolean) => void
    ): Phaser.GameObjects.Container {
        const btn = scene.add.container(x, y);

        const g = scene.add.graphics();
        const drawBtn = (held: boolean) => {
            g.clear();
            g.fillStyle(fillColor, held ? 0.9 : 0.65);
            g.fillCircle(0, 0, radius);
            g.lineStyle(held ? 4 : 2.5, strokeColor, 1);
            g.strokeCircle(0, 0, radius);
        };
        drawBtn(false);
        btn.add(g);

        const txt = scene.add.text(0, 0, label, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '17px',
            color: '#ffffff',
            fontStyle: 'bold'
        });
        txt.setOrigin(0.5, 0.5);
        btn.add(txt);

        const zone = scene.add.zone(0, 0, radius * 2, radius * 2);
        zone.setInteractive({ useHandCursor: true });
        btn.add(zone);

        zone.on('pointerdown', () => {
            drawBtn(true);
            btn.setScale(0.94);
            onHoldChange(true);
        });

        const release = () => {
            drawBtn(false);
            btn.setScale(1.0);
            onHoldChange(false);
        };
        zone.on('pointerup', release);
        zone.on('pointerout', release);

        return btn;
    }

    private createHudToggle(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
        const toggle = scene.add.container(x, y);

        const bg = scene.add.graphics();
        const drawBg = (pressed: boolean) => {
            bg.clear();
            bg.fillStyle(0x0f172a, pressed ? 0.9 : 0.7);
            bg.fillRoundedRect(-24, -24, 48, 48, 10);
            bg.lineStyle(2, 0x38bdf8, 0.85);
            bg.strokeRoundedRect(-24, -24, 48, 48, 10);
        };
        drawBg(false);
        toggle.add(bg);

        const icon = scene.add.text(0, 0, '📱', {
            fontSize: '22px',
            align: 'center'
        });
        icon.setOrigin(0.5, 0.5);
        toggle.add(icon);

        const zone = scene.add.zone(0, 0, 52, 52);
        zone.setInteractive({ useHandCursor: true });
        toggle.add(zone);

        zone.on('pointerdown', () => {
            drawBg(true);
            toggle.setScale(0.92);
            this.triggerHaptic(20);

            // Cycle mode: auto -> on -> off -> auto
            if (this.mode === 'auto') {
                this.setMode('on');
            } else if (this.mode === 'on') {
                this.setMode('off');
            } else {
                this.setMode('auto');
            }

            this.showToast(scene, `Touch Controls: ${this.mode.toUpperCase()}`);
        });

        const release = () => {
            drawBg(false);
            toggle.setScale(1.0);
        };
        zone.on('pointerup', release);
        zone.on('pointerout', release);

        return toggle;
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

        if (this.dpadBase) this.dpadBase.setVisible(active);
        if (this.dpadThumb) this.dpadThumb.setVisible(active);
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
        if (this.container) {
            this.container.destroy();
            this.container = null;
        }
        this.dpadBase = null;
        this.dpadThumb = null;
        this.btnA = null;
        this.btnRun = null;
        this.btnMenu = null;
        this.hudToggle = null;
        this.scene = null;
        this.activePointerId = null;
        this.resetDpadThumb();
    }
}
