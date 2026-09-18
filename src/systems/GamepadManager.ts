export interface GamepadState {
    connected: boolean;
    id: string;
    index: number;
    buttons: {
        a: boolean;
        b: boolean;
        x: boolean;
        y: boolean;
        lb: boolean;
        rb: boolean;
        select: boolean;
        start: boolean;
        dpadUp: boolean;
        dpadDown: boolean;
        dpadLeft: boolean;
        dpadRight: boolean;
    };
    axes: {
        leftX: number;
        leftY: number;
        rightX: number;
        rightY: number;
    };
}

export class GamepadManager {
    private static _instance: GamepadManager;

    private connectedPads: Map<number, Gamepad> = new Map();
    private deadzone: number = 0.25;
    private onConnectedCallbacks: Array<(pad: Gamepad) => void> = [];
    private onDisconnectedCallbacks: Array<(pad: Gamepad) => void> = [];

    private constructor() {
        this.initEventListeners();
    }

    public static get instance(): GamepadManager {
        if (!GamepadManager._instance) {
            GamepadManager._instance = new GamepadManager();
        }
        return GamepadManager._instance;
    }

    private initEventListeners() {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

        window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
            if (e.gamepad) {
                this.connectedPads.set(e.gamepad.index, e.gamepad);
                this.onConnectedCallbacks.forEach(cb => cb(e.gamepad));
            }
        });

        window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
            if (e.gamepad) {
                this.connectedPads.delete(e.gamepad.index);
                this.onDisconnectedCallbacks.forEach(cb => cb(e.gamepad));
            }
        });
    }

    public getDeadzone(): number {
        return this.deadzone;
    }

    public setDeadzone(deadzone: number) {
        this.deadzone = Math.max(0.05, Math.min(0.8, deadzone));
    }

    public isConnected(): boolean {
        this.pollGamepads();
        return this.connectedPads.size > 0;
    }

    public getConnectedGamepads(): Gamepad[] {
        this.pollGamepads();
        return Array.from(this.connectedPads.values());
    }

    public getPrimaryGamepad(): Gamepad | null {
        this.pollGamepads();
        if (this.connectedPads.size === 0) return null;
        const firstKey = this.connectedPads.keys().next().value;
        return firstKey !== undefined ? (this.connectedPads.get(firstKey) || null) : null;
    }

    public getPrimaryGamepadName(): string | null {
        const pad = this.getPrimaryGamepad();
        return pad ? pad.id : null;
    }

    private pollGamepads() {
        if (typeof navigator !== 'undefined' && navigator.getGamepads) {
            try {
                const pads = navigator.getGamepads();
                if (pads) {
                    for (let i = 0; i < pads.length; i++) {
                        const pad = pads[i];
                        if (pad && pad.connected) {
                            this.connectedPads.set(pad.index, pad);
                        } else if (this.connectedPads.has(i)) {
                            this.connectedPads.delete(i);
                        }
                    }
                }
            } catch {
                // Ignore browser poll security / iframe restrictions
            }
        }
    }

    public onConnect(cb: (pad: Gamepad) => void) {
        this.onConnectedCallbacks.push(cb);
    }

    public onDisconnect(cb: (pad: Gamepad) => void) {
        this.onDisconnectedCallbacks.push(cb);
    }

    /**
     * Apply deadzone threshold filter to axis value
     */
    public applyDeadzone(value: number): number {
        if (Math.abs(value) < this.deadzone) {
            return 0;
        }
        return value;
    }

    /**
     * Parse normalized gamepad state from raw W3C Gamepad object
     */
    public parseGamepadState(pad: Gamepad | null): GamepadState {
        if (!pad || !pad.connected) {
            return {
                connected: false,
                id: '',
                index: -1,
                buttons: {
                    a: false,
                    b: false,
                    x: false,
                    y: false,
                    lb: false,
                    rb: false,
                    select: false,
                    start: false,
                    dpadUp: false,
                    dpadDown: false,
                    dpadLeft: false,
                    dpadRight: false
                },
                axes: {
                    leftX: 0,
                    leftY: 0,
                    rightX: 0,
                    rightY: 0
                }
            };
        }

        const isPressed = (idx: number): boolean => {
            const btn = pad.buttons[idx];
            if (!btn) return false;
            return typeof btn === 'object' ? btn.pressed : btn === 1.0;
        };

        const rawLeftX = pad.axes[0] ?? 0;
        const rawLeftY = pad.axes[1] ?? 0;
        const rawRightX = pad.axes[2] ?? 0;
        const rawRightY = pad.axes[3] ?? 0;

        return {
            connected: true,
            id: pad.id,
            index: pad.index,
            buttons: {
                a: isPressed(0),
                b: isPressed(1),
                x: isPressed(2),
                y: isPressed(3),
                lb: isPressed(4),
                rb: isPressed(5),
                select: isPressed(8),
                start: isPressed(9),
                dpadUp: isPressed(12),
                dpadDown: isPressed(13),
                dpadLeft: isPressed(14),
                dpadRight: isPressed(15)
            },
            axes: {
                leftX: this.applyDeadzone(rawLeftX),
                leftY: this.applyDeadzone(rawLeftY),
                rightX: this.applyDeadzone(rawRightX),
                rightY: this.applyDeadzone(rawRightY)
            }
        };
    }

    /**
     * Trigger dual-rumble haptic feedback on the primary connected gamepad
     */
    public async triggerRumble(
        weakMagnitude: number = 0.5,
        strongMagnitude: number = 0.8,
        durationMs: number = 200
    ): Promise<boolean> {
        const pad = this.getPrimaryGamepad();
        if (!pad) return false;

        const actuator = (pad as any).vibrationActuator;
        if (actuator && actuator.playEffect) {
            try {
                await actuator.playEffect('dual-rumble', {
                    startDelay: 0,
                    duration: durationMs,
                    weakMagnitude: Math.min(1.0, Math.max(0, weakMagnitude)),
                    strongMagnitude: Math.min(1.0, Math.max(0, strongMagnitude))
                });
                return true;
            } catch {
                return false;
            }
        }
        return false;
    }
}
