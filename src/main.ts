import './style.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { SplashScene } from './scenes/SplashScene';
import { TitleScene } from './scenes/TitleScene';
import { IntroScene } from './scenes/IntroScene';
import { OverworldScene } from './scenes/OverworldScene';
import { MenuScene } from './scenes/MenuScene';
import { BattleScene } from './scenes/BattleScene';
import { CreditsScene } from './scenes/CreditsScene';
import { AdminDashboardScene } from './scenes/AdminDashboardScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1330,
        height: 998,
        parent: 'app',
        expandParent: true
    },
    render: {
        pixelArt: false,
        antialias: true,
        antialiasGL: true,
        roundPixels: false
    },
    input: {
        gamepad: true
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [BootScene, SplashScene, TitleScene, IntroScene, OverworldScene, MenuScene, BattleScene, CreditsScene, AdminDashboardScene]
};

const game = new Phaser.Game(config);

// Global Error & Freeze Recovery Guard:
// Catches uncaught runtime exceptions and provides an emergency reload / copy diagnostics banner
if (typeof window !== 'undefined') {
    const showCrashBanner = (errorMsg: string) => {
        if (document.getElementById('swiftsouls-recovery-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'swiftsouls-recovery-banner';
        banner.style.cssText = `
            position: fixed;
            top: 14px;
            left: 50%;
            transform: translateX(-50%);
            background: #0f1422;
            border: 2px solid #ff4455;
            color: #ffffff;
            padding: 10px 18px;
            border-radius: 8px;
            z-index: 999999;
            font-family: monospace, sans-serif;
            font-size: 13px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.85);
            display: flex;
            gap: 10px;
            align-items: center;
            max-width: 90vw;
            flex-wrap: wrap;
        `;

        const label = document.createElement('span');
        label.innerHTML = '⚠️ <strong>Game Glitch Detected:</strong> Your save progress is safe!';
        banner.appendChild(label);

        const copyBtn = document.createElement('button');
        copyBtn.innerText = '📋 Copy Error Info';
        copyBtn.style.cssText = 'background:#182845; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; padding:4px 10px; cursor:pointer; font-family:monospace;';
        copyBtn.onclick = () => {
            const diag = `[SwiftSouls Diagnostic Log]\nError: ${errorMsg}\nTime: ${new Date().toISOString()}\nUrl: ${window.location.href}`;
            navigator.clipboard.writeText(diag).then(() => {
                copyBtn.innerText = '✅ Copied!';
                setTimeout(() => { copyBtn.innerText = '📋 Copy Error Info'; }, 3000);
            }).catch(() => {
                copyBtn.innerText = 'Error details copied to console';
            });
        };
        banner.appendChild(copyBtn);

        const reloadBtn = document.createElement('button');
        reloadBtn.innerText = '↺ Reload & Resume';
        reloadBtn.style.cssText = 'background:#006655; color:#ffffff; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-weight:bold; font-family:monospace;';
        reloadBtn.onclick = () => {
            window.location.reload();
        };
        banner.appendChild(reloadBtn);

        const dismissBtn = document.createElement('button');
        dismissBtn.innerText = '✕';
        dismissBtn.style.cssText = 'background:transparent; color:#8899b3; border:none; cursor:pointer; font-size:16px; padding:0 4px;';
        dismissBtn.onclick = () => {
            banner.remove();
        };
        banner.appendChild(dismissBtn);

        document.body.appendChild(banner);
    };

    window.addEventListener('error', (event) => {
        console.error('[SwiftSouls Global Error Guard]', event.error || event.message);
        const msg = event.error?.message || event.message || 'Unknown runtime exception';
        showCrashBanner(msg);
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('[SwiftSouls Global Rejection Guard]', event.reason);
        const msg = typeof event.reason === 'string' ? event.reason : (event.reason?.message || 'Unhandled asynchronous error');
        showCrashBanner(msg);
    });

    // Fullscreen Controller for Web & Mobile
    const fsBtn = document.getElementById('swiftsouls-fullscreen-toggle');
    
    const isCurrentlyFullscreen = () => {
        return Boolean(
            document.fullscreenElement ||
            (document as any).webkitFullscreenElement ||
            (document as any).mozFullScreenElement ||
            (document as any).msFullscreenElement
        );
    };

    const updateFsBtnDisplay = () => {
        if (!fsBtn) return;
        const isFs = isCurrentlyFullscreen();
        const icon = fsBtn.querySelector('.fs-icon');
        const text = fsBtn.querySelector('.fs-text');
        if (isFs) {
            if (icon) icon.textContent = '🗗';
            if (text) text.textContent = 'Exit';
            fsBtn.setAttribute('title', 'Exit Fullscreen (F)');
        } else {
            if (icon) icon.textContent = '⛶';
            if (text) text.textContent = 'Fullscreen';
            fsBtn.setAttribute('title', 'Toggle Fullscreen (F)');
        }
    };

    const toggleGameFullscreen = async () => {
        try {
            if (!isCurrentlyFullscreen()) {
                const elem = document.documentElement;
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if ((elem as any).webkitRequestFullscreen) {
                    await (elem as any).webkitRequestFullscreen();
                } else if ((elem as any).mozRequestFullScreen) {
                    await (elem as any).mozRequestFullScreen();
                } else if ((elem as any).msRequestFullscreen) {
                    await (elem as any).msRequestFullscreen();
                } else if ((game.scale as any).startFullscreen) {
                    game.scale.startFullscreen();
                }
            } else {
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if ((document as any).webkitExitFullscreen) {
                    await (document as any).webkitExitFullscreen();
                } else if ((document as any).mozCancelFullScreen) {
                    await (document as any).mozCancelFullScreen();
                } else if ((document as any).msExitFullscreen) {
                    await (document as any).msExitFullscreen();
                } else if ((game.scale as any).stopFullscreen) {
                    game.scale.stopFullscreen();
                }
            }
        } catch (e) {
            console.warn('[SwiftSouls Fullscreen]', e);
        }
        updateFsBtnDisplay();
    };

    if (fsBtn) {
        fsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleGameFullscreen();
        });
    }

    // Keyboard 'F' key toggle
    window.addEventListener('keydown', (e) => {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
        if (e.key === 'f' || e.key === 'F') {
            toggleGameFullscreen();
        }
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
        document.addEventListener(evt, updateFsBtnDisplay);
    });

    // Hash routing support for #admin
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#admin') {
            game.scene.start('AdminDashboardScene', { returnScene: 'TitleScene' });
        }
    });
}

