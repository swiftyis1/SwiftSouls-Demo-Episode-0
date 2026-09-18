import Phaser from 'phaser';
import { UserAuthManager } from '../systems/UserAuthManager.ts';
import { LiveOpsManager, type BugReport } from '../systems/LiveOpsManager.ts';
import { SoundSynth } from '../systems/SoundSynth.ts';

export type DashboardTab = 'overview' | 'users' | 'vault' | 'bugs' | 'backups';

export class AdminDashboardScene extends Phaser.Scene {
    private activeTab: DashboardTab = 'overview';
    private returnScene: string = 'TitleScene';
    private tabContainer!: Phaser.GameObjects.Container;
    private contentContainer!: Phaser.GameObjects.Container;
    private statusToastText?: Phaser.GameObjects.Text;

    constructor() {
        super('AdminDashboardScene');
    }

    init(data: { returnScene?: string }) {
        if (data && data.returnScene) {
            this.returnScene = data.returnScene;
        }
    }

    create() {
        const { width, height } = this.scale;

        // Dark tech background
        const bg = this.add.graphics();
        bg.fillStyle(0x060810, 1);
        bg.fillRect(0, 0, width, height);

        // Subtle grid pattern
        bg.lineStyle(1, 0x142035, 0.4);
        for (let x = 0; x < width; x += 40) {
            bg.lineBetween(x, 0, x, height);
        }
        for (let y = 0; y < height; y += 40) {
            bg.lineBetween(0, y, width, y);
        }

        // Check Admin Authorization
        if (!LiveOpsManager.instance.isAuthorizedAdmin()) {
            this.createUnauthorizedScreen(width, height);
            return;
        }

        this.createHeader(width);
        this.createNavigationTabs(width);

        this.contentContainer = this.add.container(0, 0);
        this.renderActiveTab(width, height);

        // Keyboard navigation
        if (this.input.keyboard) {
            this.input.keyboard.on('keydown-ESC', () => {
                this.exitDashboard();
            });
        }
    }

    private createUnauthorizedScreen(width: number, height: number) {
        const card = this.add.graphics();
        card.fillStyle(0x1a080c, 0.95);
        card.lineStyle(4, 0xff3344, 1);
        card.fillRoundedRect(width / 2 - 380, height / 2 - 180, 760, 360, 16);
        card.strokeRoundedRect(width / 2 - 380, height / 2 - 180, 760, 360, 16);

        this.add.text(width / 2, height / 2 - 90, '⛔ ACCESS DENIED', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '38px',
            color: '#ff3344',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        this.add.text(width / 2, height / 2 - 20, 'Administrative terminal is restricted to authorized credentials:\ndavidswift0920@gmail.com\n\nPlease sign in with your verified administrator account.', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ffffff',
            align: 'center',
            lineSpacing: 10
        }).setOrigin(0.5, 0.5);

        const btn = this.add.text(width / 2, height / 2 + 90, '[ ✕ RETURN TO TITLE ]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '26px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });

        btn.on('pointerdown', () => this.exitDashboard());
    }

    private createHeader(width: number) {
        const headerBg = this.add.graphics();
        headerBg.fillStyle(0x0c1220, 0.95);
        headerBg.lineStyle(2, 0x00ffcc, 0.8);
        headerBg.fillRect(0, 0, width, 70);
        headerBg.strokeLineShape(new Phaser.Geom.Line(0, 70, width, 70));

        // Title
        this.add.text(24, 22, '⚡ PROJECT SWIFTSOULS // LIVE-OPS & VAULT ADMIN', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '24px',
            color: '#ffd700',
            fontStyle: 'bold'
        });

        // Admin Profile Badge
        const profile = UserAuthManager.instance.getProfile();
        const emailLabel = profile.email || 'Admin (Local Dev)';
        this.add.text(width - 320, 26, `👤 ${emailLabel} [ADMIN]`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#00ffcc'
        }).setOrigin(1, 0);

        // Unread bugs badge
        const unreadCount = LiveOpsManager.instance.getUnreadBugCount();
        const bugColor = unreadCount > 0 ? '#ff3344' : '#8899b3';
        this.add.text(width - 150, 26, `🐞 Bugs: ${unreadCount}`, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: bugColor,
            fontStyle: unreadCount > 0 ? 'bold' : 'normal'
        });

        // Return button
        const returnBtn = this.add.text(width - 24, 22, '[✕ EXIT]', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#ff6666',
            fontStyle: 'bold'
        }).setOrigin(1, 0).setInteractive({ useHandCursor: true });

        returnBtn.on('pointerover', () => returnBtn.setColor('#ff3333'));
        returnBtn.on('pointerout', () => returnBtn.setColor('#ff6666'));
        returnBtn.on('pointerdown', () => this.exitDashboard());

        // Toast message placeholder
        this.statusToastText = this.add.text(width / 2, 85, '', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc'
        }).setOrigin(0.5, 0.5);
    }

    private createNavigationTabs(width: number) {
        this.tabContainer = this.add.container(0, 80);

        const tabs: Array<{ id: DashboardTab; label: string }> = [
            { id: 'overview', label: '📊 OVERVIEW' },
            { id: 'users', label: '👥 USERS & TIERS' },
            { id: 'vault', label: '💎 PREMIUM VAULT' },
            { id: 'bugs', label: '🐞 BUG REPORTS' },
            { id: 'backups', label: '📦 24H BACKUPS & DR' }
        ];

        const tabWidth = 260;
        const startX = 30;

        tabs.forEach((tab, index) => {
            const x = startX + index * tabWidth;
            const isCurrent = this.activeTab === tab.id;

            const bg = this.add.graphics();
            this.drawTabBg(bg, isCurrent);

            const label = this.add.text(tabWidth / 2, 20, tab.label, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: isCurrent ? '#ffffff' : '#8899b3',
                fontStyle: isCurrent ? 'bold' : 'normal'
            }).setOrigin(0.5, 0.5);

            const tabItem = this.add.container(x, 0, [bg, label]);
            tabItem.setSize(tabWidth - 10, 42);
            tabItem.setInteractive(new Phaser.Geom.Rectangle(0, 0, tabWidth - 10, 42), Phaser.Geom.Rectangle.Contains);

            tabItem.on('pointerdown', () => {
                SoundSynth.playMenuSelect();
                this.activeTab = tab.id;
                this.tabContainer.destroy();
                this.createNavigationTabs(width);
                this.renderActiveTab(width, this.scale.height);
            });

            this.tabContainer.add(tabItem);
        });
    }

    private drawTabBg(g: Phaser.GameObjects.Graphics, isActive: boolean) {
        g.clear();
        if (isActive) {
            g.fillStyle(0x182642, 1);
            g.lineStyle(2, 0x00ffcc, 1);
            g.fillRoundedRect(0, 0, 250, 40, 8);
            g.strokeRoundedRect(0, 0, 250, 40, 8);
        } else {
            g.fillStyle(0x0a101c, 0.8);
            g.lineStyle(1, 0x223350, 0.8);
            g.fillRoundedRect(0, 0, 250, 40, 8);
            g.strokeRoundedRect(0, 0, 250, 40, 8);
        }
    }

    private renderActiveTab(width: number, height: number) {
        this.contentContainer.removeAll(true);

        switch (this.activeTab) {
            case 'overview':
                this.renderOverviewTab(width, height);
                break;
            case 'users':
                this.renderUsersTab(width, height);
                break;
            case 'vault':
                this.renderVaultTab(width, height);
                break;
            case 'bugs':
                this.renderBugsTab(width, height);
                break;
            case 'backups':
                this.renderBackupsTab(width, height);
                break;
        }
    }

    // --- Tab 1: Overview & Extinction Telemetry ---
    private renderOverviewTab(width: number, _height: number) {
        const startY = 145;

        // Telemetry header
        const title = this.add.text(32, startY, 'SPECIES EXTINCTION TELEMETRY (CANONICAL HUNT CAMPAIGN)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });
        this.contentContainer.add(title);

        const telemetry = LiveOpsManager.instance.getExtinctionTelemetry();
        const speciesKeys = Object.keys(telemetry);

        speciesKeys.forEach((key, idx) => {
            const rowY = startY + 50 + idx * 62;
            const data = telemetry[key];
            const percent = Math.min(100, Math.round((data.totalKills / 255) * 100));

            // Name
            const label = this.add.text(40, rowY + 12, `${data.name.padEnd(16)}: ${data.totalKills}/255`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: data.isExtinct ? '#ff4455' : '#ffffff'
            });

            // Progress Bar Background
            const barBg = this.add.graphics();
            barBg.fillStyle(0x101828, 1);
            barBg.lineStyle(1, 0x2d436a, 1);
            barBg.fillRoundedRect(380, rowY + 6, 600, 28, 6);
            barBg.strokeRoundedRect(380, rowY + 6, 600, 28, 6);

            // Progress Bar Fill
            const fillWidth = Math.max(4, Math.round((600 * percent) / 100));
            const barFill = this.add.graphics();
            barFill.fillStyle(data.isExtinct ? 0xff3344 : 0x00ccaa, 1);
            barFill.fillRoundedRect(380, rowY + 6, fillWidth, 28, 6);

            // Status Badge
            const statusStr = data.isExtinct ? '★ EXTINCT ★' : `${percent}% HARVESTED`;
            const statusText = this.add.text(1000, rowY + 12, statusStr, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: data.isExtinct ? '#ff3344' : '#00ffcc',
                fontStyle: 'bold'
            });

            this.contentContainer.add([label, barBg, barFill, statusText]);
        });

        // Quick Stats Panel
        const statsY = startY + 440;
        const totalUsers = LiveOpsManager.instance.getAllUsers().length;
        const premiumCount = LiveOpsManager.instance.getPremiumVaultRecords().length;
        const bugCount = LiveOpsManager.instance.getBugReports().length;
        const backupsCount = LiveOpsManager.instance.getBackupsList().length;

        const summaryBox = this.add.graphics();
        summaryBox.fillStyle(0x0e1728, 0.9);
        summaryBox.lineStyle(2, 0x00ffcc, 0.5);
        summaryBox.fillRoundedRect(32, statsY, width - 64, 130, 12);
        summaryBox.strokeRoundedRect(32, statsY, width - 64, 130, 12);

        const summaryText = this.add.text(50, statsY + 20, 
            `📊 LIVE-OPS QUICK SUMMARY:\n` +
            `• Registered Players / Sessions: ${totalUsers}    • Premium Commercial Vault Licenses: ${premiumCount}\n` +
            `• Bug Submissions Tracked: ${bugCount}           • 24-Hour Rolling Backups Retained: ${backupsCount}`,
            {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '20px',
                color: '#ffffff',
                lineSpacing: 12
            }
        );

        this.contentContainer.add([summaryBox, summaryText]);
    }

    // --- Tab 2: Users & Tiers ---
    private renderUsersTab(width: number, _height: number) {
        const startY = 145;

        // Table Header
        const header = this.add.text(32, startY, 'REGISTERED PLAYERS & IDENTITIES', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });

        // Export CSV Button
        const exportBtn = this.createActionButton(width - 240, startY - 6, '📥 EXPORT CSV', () => {
            this.downloadCSV('users_and_tiers.csv', LiveOpsManager.instance.getUsersCSV());
        });

        this.contentContainer.add([header, exportBtn]);

        // Table column headers
        const colHeaderY = startY + 45;
        const colHeader = this.add.text(32, colHeaderY, 
            'EMAIL / IDENTIFIER            PROVIDER    VERIFIED    TIER          SOUL LVL    LAST ACTIVE', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#8899b3',
                fontStyle: 'bold'
            }
        );
        this.contentContainer.add(colHeader);

        const users = LiveOpsManager.instance.getAllUsers();
        if (users.length === 0) {
            const emptyText = this.add.text(32, colHeaderY + 40, 'No registered users found.', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: '#8899b3'
            });
            this.contentContainer.add(emptyText);
            return;
        }

        users.slice(0, 10).forEach((user, idx) => {
            const rowY = colHeaderY + 36 + idx * 38;
            const emailStr = (user.email || 'unlinked').padEnd(30).substring(0, 30);
            const provStr = user.authProvider.padEnd(12);
            const verStr = (user.verified ? 'YES' : 'NO').padEnd(12);
            const tierStr = user.tier.toUpperCase().padEnd(14);
            const lvlStr = user.soulLevel.toString().padEnd(12);
            const dateStr = new Date(user.lastActiveAt).toLocaleDateString();

            const rowText = this.add.text(32, rowY, 
                `${emailStr} ${provStr} ${verStr} ${tierStr} ${lvlStr} ${dateStr}`, {
                    fontFamily: '"Courier New", Courier, monospace',
                    fontSize: '16px',
                    color: user.tier === 'commercial' ? '#ffd700' : '#ffffff'
                }
            );
            this.contentContainer.add(rowText);
        });
    }

    // --- Tab 3: Premium Vault ---
    private renderVaultTab(width: number, height: number) {
        const startY = 145;

        const header = this.add.text(32, startY, 'COMMERCIAL EDITION PREMIUM VAULT (EMAIL BONDED)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#ffd700',
            fontStyle: 'bold'
        });

        // Export CSV Button
        const exportBtn = this.createActionButton(width - 240, startY - 6, '📥 EXPORT CSV', () => {
            this.downloadCSV('premium_accounts.csv', LiveOpsManager.instance.getPremiumVaultCSV());
        });

        this.contentContainer.add([header, exportBtn]);

        // Grant / Revoke Controls Box
        const formY = startY + 45;
        const formBox = this.add.graphics();
        formBox.fillStyle(0x0e1728, 0.9);
        formBox.lineStyle(1.5, 0x00ffcc, 0.6);
        formBox.fillRoundedRect(32, formY, width - 64, 110, 10);
        formBox.strokeRoundedRect(32, formY, width - 64, 110, 10);

        const formTitle = this.add.text(50, formY + 16, 'ADMIN LICENSE MANAGEMENT FORM:', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '18px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });

        // Grant Button
        const grantBtn = this.createActionButton(50, formY + 54, '➕ GRANT COMMERCIAL BY EMAIL', () => {
            this.openPromptModal(
                'GRANT COMMERCIAL LICENSE',
                'Enter player email address to grant permanent Commercial Tier:',
                'player@example.com',
                (input) => {
                    const res = LiveOpsManager.instance.grantCommercialByAdmin(input);
                    this.showToast(res.message);
                    this.renderActiveTab(width, height);
                }
            );
        });

        // Revoke Button
        const revokeBtn = this.createActionButton(380, formY + 54, '➖ REVOKE COMMERCIAL BY EMAIL', () => {
            this.openPromptModal(
                'REVOKE COMMERCIAL LICENSE',
                'Enter player email address to revoke Commercial Tier:',
                'player@example.com',
                (input) => {
                    const res = LiveOpsManager.instance.revokeCommercialByAdmin(input);
                    this.showToast(res.message);
                    this.renderActiveTab(width, height);
                }
            );
        });

        this.contentContainer.add([formBox, formTitle, grantBtn, revokeBtn]);

        // Records Table
        const tableY = formY + 130;
        const colHeader = this.add.text(32, tableY, 
            'BONDED EMAIL                  RAIL            RECOVERY TOKEN       DATE GRANTED', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#8899b3',
                fontStyle: 'bold'
            }
        );
        this.contentContainer.add(colHeader);

        const vaultRecords = LiveOpsManager.instance.getPremiumVaultRecords();
        if (vaultRecords.length === 0) {
            const emptyText = this.add.text(32, tableY + 36, 'No commercial licenses registered in vault yet.', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: '#8899b3'
            });
            this.contentContainer.add(emptyText);
            return;
        }

        vaultRecords.slice(0, 8).forEach((r, idx) => {
            const rowY = tableY + 36 + idx * 36;
            const emailStr = r.email.padEnd(30).substring(0, 30);
            const railStr = r.paymentRail.padEnd(16);
            const tokenStr = r.recoveryToken.padEnd(21);
            const dateStr = new Date(r.grantedAt).toLocaleDateString();

            const text = this.add.text(32, rowY, `${emailStr} ${railStr} ${tokenStr} ${dateStr}`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffd700'
            });
            this.contentContainer.add(text);
        });
    }

    // --- Tab 4: Bug Reports ---
    private renderBugsTab(width: number, height: number) {
        const startY = 145;

        const header = this.add.text(32, startY, 'BUG REPORT REGISTRY (WITH CANVAS TELEMETRY)', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#ff4455',
            fontStyle: 'bold'
        });

        const exportBtn = this.createActionButton(width - 240, startY - 6, '📥 EXPORT CSV', () => {
            this.downloadCSV('bug_reports.csv', LiveOpsManager.instance.getBugReportsCSV());
        });

        this.contentContainer.add([header, exportBtn]);

        const colHeaderY = startY + 45;
        const colHeader = this.add.text(32, colHeaderY, 
            'REPORT ID       STATUS          PLAYER EMAIL             MAP / COORDS           DESCRIPTION', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#8899b3',
                fontStyle: 'bold'
            }
        );
        this.contentContainer.add(colHeader);

        const bugs = LiveOpsManager.instance.getBugReports();
        if (bugs.length === 0) {
            const emptyText = this.add.text(32, colHeaderY + 40, 'No bugs reported! The realm is running stably.', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: '#00ffcc'
            });
            this.contentContainer.add(emptyText);
            return;
        }

        bugs.slice(0, 8).forEach((b, idx) => {
            const rowY = colHeaderY + 36 + idx * 48;
            const idStr = b.id.padEnd(16).substring(0, 16);
            const statusColor = b.status === 'unread' ? '#ff3344' : (b.status === 'investigating' ? '#ffd700' : '#00ffcc');
            const statusStr = b.status.toUpperCase().padEnd(16);
            const emailStr = (b.playerEmail || 'Anon').padEnd(25).substring(0, 25);
            const locStr = `${b.mapId} (${b.coordinates.x},${b.coordinates.y})`.padEnd(23).substring(0, 23);
            const descStr = b.description.substring(0, 36);

            const row = this.add.text(32, rowY, `${idStr} ${statusStr} ${emailStr} ${locStr} ${descStr}`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: statusColor
            });

            // Action: toggle status button
            const toggleBtn = this.add.text(width - 160, rowY, '[CHANGE STATUS]', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '14px',
                color: '#00ffcc'
            }).setInteractive({ useHandCursor: true });

            toggleBtn.on('pointerdown', () => {
                const nextStatus: BugReport['status'] = b.status === 'unread' ? 'investigating' : (b.status === 'investigating' ? 'resolved' : 'unread');
                LiveOpsManager.instance.updateBugStatus(b.id, nextStatus);
                this.renderActiveTab(width, height);
            });

            this.contentContainer.add([row, toggleBtn]);
        });
    }

    // --- Tab 5: 24h Backups & Disaster Recovery ---
    private renderBackupsTab(width: number, height: number) {
        const startY = 145;

        const header = this.add.text(32, startY, '24-HOUR AUTOMATED ROLLING BACKUPS & DISASTER RECOVERY', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '22px',
            color: '#00ffcc',
            fontStyle: 'bold'
        });

        // Manual Backup Button
        const manualBtn = this.createActionButton(width - 520, startY - 6, '📦 TAKE SNAPSHOT NOW', () => {
            const success = LiveOpsManager.instance.createDailyBackupSnapshot();
            this.showToast(success ? 'New snapshot created!' : 'Failed to create snapshot.');
            this.renderActiveTab(width, height);
        });

        // Download Offsite Bundle
        const offsiteBtn = this.createActionButton(width - 270, startY - 6, '💾 DOWNLOAD OFFSITE JSON', () => {
            const bundle = LiveOpsManager.instance.generateDisasterRecoveryBundle();
            const dateStr = new Date().toISOString().split('T')[0];
            this.downloadJSON(`swiftsouls_backup_${dateStr}.json`, bundle);
        });

        this.contentContainer.add([header, manualBtn, offsiteBtn]);

        // Restore file trigger
        const restoreFileBtn = this.createActionButton(32, startY + 50, '📂 RESTORE SYSTEM FROM JSON BUNDLE', () => {
            this.openPromptModal(
                'RESTORE SYSTEM BUNDLE',
                'Paste full JSON Disaster Recovery string to restore:',
                '',
                (input) => {
                    const res = LiveOpsManager.instance.restoreDisasterRecoveryBundle(input);
                    this.showToast(res.message);
                    this.renderActiveTab(width, height);
                }
            );
        });
        this.contentContainer.add(restoreFileBtn);

        // Snapshots list table
        const tableY = startY + 115;
        const colHeader = this.add.text(32, tableY, 
            'SNAPSHOT DATE      SIZE (BYTES)     TIMESTAMP            ACTION', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#8899b3',
                fontStyle: 'bold'
            }
        );
        this.contentContainer.add(colHeader);

        const backups = LiveOpsManager.instance.getBackupsList();
        if (backups.length === 0) {
            const emptyText = this.add.text(32, tableY + 36, 'No daily rolling backups found yet.', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '18px',
                color: '#8899b3'
            });
            this.contentContainer.add(emptyText);
            return;
        }

        backups.slice(0, 8).forEach((b, idx) => {
            const rowY = tableY + 36 + idx * 40;
            const dateStr = b.dateStr.padEnd(19);
            const sizeStr = b.sizeBytes.toString().padEnd(17);
            const tsStr = new Date(b.timestamp).toLocaleString().padEnd(21);

            const row = this.add.text(32, rowY, `${dateStr} ${sizeStr} ${tsStr}`, {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '16px',
                color: '#ffffff'
            });

            const rollbackBtn = this.add.text(width - 260, rowY, '[ROLLBACK THIS SNAPSHOT]', {
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: '15px',
                color: '#ffd700',
                fontStyle: 'bold'
            }).setInteractive({ useHandCursor: true });

            rollbackBtn.on('pointerdown', () => {
                if (confirm(`Are you sure you want to rollback to snapshot ${b.dateStr}?`)) {
                    const ok = LiveOpsManager.instance.restoreFromBackup(b.key);
                    this.showToast(ok ? `Rolled back to ${b.dateStr}!` : 'Rollback failed.');
                }
            });

            this.contentContainer.add([row, rollbackBtn]);
        });
    }

    // --- Action Button Helper ---
    private createActionButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
        const padding = 16;
        const tempText = this.add.text(0, 0, text, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            fontStyle: 'bold'
        });
        const btnWidth = tempText.width + padding * 2;
        const btnHeight = 36;
        tempText.destroy();

        const bg = this.add.graphics();
        bg.fillStyle(0x1a2842, 1);
        bg.lineStyle(1.5, 0x00ffcc, 1);
        bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 6);
        bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 6);

        const label = this.add.text(btnWidth / 2, btnHeight / 2, text, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '16px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const container = this.add.container(x, y, [bg, label]);
        container.setSize(btnWidth, btnHeight);
        container.setInteractive(new Phaser.Geom.Rectangle(0, 0, btnWidth, btnHeight), Phaser.Geom.Rectangle.Contains);

        container.on('pointerover', () => {
            bg.clear();
            bg.fillStyle(0x28406a, 1);
            bg.lineStyle(2, 0xffffff, 1);
            bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 6);
            bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 6);
            label.setColor('#ffffff');
        });

        container.on('pointerout', () => {
            bg.clear();
            bg.fillStyle(0x1a2842, 1);
            bg.lineStyle(1.5, 0x00ffcc, 1);
            bg.fillRoundedRect(0, 0, btnWidth, btnHeight, 6);
            bg.strokeRoundedRect(0, 0, btnWidth, btnHeight, 6);
            label.setColor('#00ffcc');
        });

        container.on('pointerdown', () => {
            SoundSynth.playMenuSelect();
            onClick();
        });

        return container;
    }

    private showToast(msg: string) {
        if (!this.statusToastText) return;
        this.statusToastText.setText(msg);
        this.statusToastText.setAlpha(1);
        this.tweens.add({
            targets: this.statusToastText,
            alpha: 0,
            delay: 4000,
            duration: 800
        });
    }

    private downloadCSV(filename: string, csvContent: string) {
        if (typeof window === 'undefined' || !window.document) return;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.showToast(`Downloaded ${filename}`);
    }

    private downloadJSON(filename: string, jsonContent: string) {
        if (typeof window === 'undefined' || !window.document) return;
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.showToast(`Downloaded ${filename}`);
    }

    private openPromptModal(title: string, promptText: string, defaultValue: string, onConfirm: (val: string) => void) {
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        let inputValue = defaultValue;

        const modalContainer = this.add.container(width / 2, height / 2);
        modalContainer.setDepth(600);

        // Backdrop
        const backdrop = this.add.graphics();
        backdrop.fillStyle(0x040810, 0.95);
        backdrop.fillRect(-width / 2, -height / 2, width, height);
        backdrop.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

        // Panel Box
        const modalBox = this.add.graphics();
        modalBox.fillStyle(0x0e1728, 0.98);
        modalBox.lineStyle(2, 0x00ffcc, 1);
        modalBox.fillRoundedRect(-320, -140, 640, 280, 12);
        modalBox.strokeRoundedRect(-320, -140, 640, 280, 12);

        const titleText = this.add.text(0, -105, title, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '20px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const promptDesc = this.add.text(0, -65, promptText, {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#ffffff',
            wordWrap: { width: 580 },
            align: 'center'
        }).setOrigin(0.5, 0.5);

        // Input display box
        const inputBg = this.add.graphics();
        inputBg.fillStyle(0x060c18, 1);
        inputBg.lineStyle(1.5, 0x38bdf8, 0.8);
        inputBg.fillRoundedRect(-280, -25, 560, 44, 8);
        inputBg.strokeRoundedRect(-280, -25, 560, 44, 8);

        const valText = this.add.text(0, -3, inputValue || 'Click or type...', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '15px',
            color: inputValue ? '#00ffcc' : '#8899b3'
        }).setOrigin(0.5, 0.5);

        // Paste from clipboard button
        const pasteBtnBg = this.add.graphics();
        pasteBtnBg.fillStyle(0x1a2842, 1);
        pasteBtnBg.lineStyle(1, 0x00ffcc, 0.6);
        pasteBtnBg.fillRoundedRect(-280, 35, 190, 36, 6);
        pasteBtnBg.strokeRoundedRect(-280, 35, 190, 36, 6);
        const pasteLabel = this.add.text(-185, 53, '📋 PASTE CLIPBOARD', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '13px',
            color: '#00ffcc',
            fontStyle: 'bold'
        }).setOrigin(0.5, 0.5);

        const pasteContainer = this.add.container(0, 0, [pasteBtnBg, pasteLabel]);
        pasteContainer.setSize(190, 36);
        pasteContainer.setInteractive(new Phaser.Geom.Rectangle(-280, 35, 190, 36), Phaser.Geom.Rectangle.Contains);
        pasteContainer.on('pointerdown', async () => {
            SoundSynth.playMenuBlip();
            if (navigator.clipboard && navigator.clipboard.readText) {
                try {
                    const text = await navigator.clipboard.readText();
                    if (text) {
                        inputValue = text.trim();
                        valText.setText(inputValue.length > 45 ? inputValue.substring(0, 42) + '...' : inputValue);
                        valText.setColor('#00ffcc');
                    }
                } catch {
                    // Clipboard permissions fallback
                }
            }
        });

        // Key handler for typing
        const keyHandler = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeModal();
            } else if (event.key === 'Enter') {
                confirmModal();
            } else if (event.key === 'Backspace') {
                if (inputValue.length > 0) {
                    inputValue = inputValue.slice(0, -1);
                    valText.setText(inputValue || 'Click or type...');
                    valText.setColor(inputValue ? '#00ffcc' : '#8899b3');
                }
            } else if (event.key.length === 1 && inputValue.length < 256) {
                inputValue += event.key;
                valText.setText(inputValue.length > 45 ? inputValue.substring(0, 42) + '...' : inputValue);
                valText.setColor('#00ffcc');
            }
        };

        if (this.input.keyboard) {
            this.input.keyboard.on('keydown', keyHandler);
        }

        const closeModal = () => {
            SoundSynth.playMenuCancel();
            if (this.input.keyboard) {
                this.input.keyboard.off('keydown', keyHandler);
            }
            modalContainer.destroy();
        };

        const confirmModal = () => {
            if (inputValue.trim().length > 0) {
                SoundSynth.playMenuSelect();
                if (this.input.keyboard) {
                    this.input.keyboard.off('keydown', keyHandler);
                }
                modalContainer.destroy();
                onConfirm(inputValue.trim());
            } else {
                SoundSynth.playMenuCancel();
            }
        };

        // Confirm Button
        const confirmBtn = this.createActionButton(-60, 35, '✔ CONFIRM', () => {
            confirmModal();
        });

        // Cancel Button
        const cancelBtn = this.createActionButton(80, 35, '✕ CANCEL', () => {
            closeModal();
        });

        modalContainer.add([backdrop, modalBox, titleText, promptDesc, inputBg, valText, pasteContainer, confirmBtn, cancelBtn]);
    }

    private exitDashboard() {
        SoundSynth.playMenuCancel();
        this.scene.start(this.returnScene);
    }
}
