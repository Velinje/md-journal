const path = require('path');
const cp = require('child_process');
const fs = require('fs');
const { downloadAndUnzipVSCode } = require('@vscode/test-electron');

async function main() {
    try {
        const persist = process.argv.includes('--persist');

        console.log('Downloading/locating isolated VS Code stable build...');
        const executablePath = await downloadAndUnzipVSCode('stable');

        const extensionDevelopmentPath = path.resolve(__dirname, '..');
        const userDataDir = path.join(extensionDevelopmentPath, '.vscode-test', 'user-data');
        const extensionsDir = path.join(extensionDevelopmentPath, '.vscode-test', 'extensions');
        const testWorkspace = path.join(extensionDevelopmentPath, '.vscode-test', 'test-workspace');

        if (!persist) {
            console.log('Cleaning sandbox state for a fresh install...');
            for (const dir of [userDataDir, testWorkspace, path.join(extensionDevelopmentPath, '.vscode-test', 'sandbox-journal')]) {
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            }
        } else {
            console.log('Reusing existing sandbox state (--persist mode).');
        }

        fs.mkdirSync(testWorkspace, { recursive: true });

        // Pre-seed isolated settings so the extension never reads from ~/md-journal
        const sandboxJournalPath = path.join(extensionDevelopmentPath, '.vscode-test', 'sandbox-journal');
        const userSettingsDir = path.join(userDataDir, 'User');
        fs.mkdirSync(userSettingsDir, { recursive: true });
        fs.mkdirSync(sandboxJournalPath, { recursive: true });
        const sandboxSettings = {
            'md-journal.journalPath': sandboxJournalPath
        };
        fs.writeFileSync(
            path.join(userSettingsDir, 'settings.json'),
            JSON.stringify(sandboxSettings, null, 2)
        );
        console.log(`- Journal Path:  ${sandboxJournalPath} (isolated)`);

        console.log('Booting Extension Sandbox...');
        console.log(`- Mode:          ${persist ? 'persistent' : 'fresh (clean)'}`);
        console.log(`- User Data Dir: ${userDataDir}`);
        console.log(`- Workspace:     ${testWorkspace}`);

        const args = [
            `--extensionDevelopmentPath=${extensionDevelopmentPath}`,
            `--user-data-dir=${userDataDir}`,
            `--extensions-dir=${extensionsDir}`,
            `--disable-workspace-trust`,
            `--disable-telemetry`,
            testWorkspace
        ];

        // spawnSync blocks until the developer closes the VS Code window
        const child = cp.spawnSync(executablePath, args, { stdio: 'inherit' });

        console.log('Sandbox session gracefully terminated.');
        process.exit(child.status || 0);
    } catch (err) {
        console.error('Failed to boot VS Code sandbox:', err);
        process.exit(1);
    }
}

main();
