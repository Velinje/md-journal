import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

suite('Extension Test Suite', () => {
    let originalJournalPath: string | undefined;

    suiteSetup(() => {
        const config = vscode.workspace.getConfiguration('md-journal').inspect<string>('journalPath');
        originalJournalPath = config?.globalValue;
    });

    suiteTeardown(async () => {
        await vscode.workspace.getConfiguration('md-journal').update('journalPath', originalJournalPath, vscode.ConfigurationTarget.Global);
    });

    vscode.window.showInformationMessage('Start all tests.');

    test('Sample test', () => {
        assert.strictEqual(-1, [1, 2, 3].indexOf(5));
        assert.strictEqual(-1, [1, 2, 3].indexOf(0));
    });

    test('Should index tags and backlinks on startup', async () => {

        const extension = vscode.extensions.getExtension('fuzzyoutput.md-journal');
        if (!extension) {
            assert.fail('Extension not found');
        }

        const testJournalPath = fs.mkdtempSync(path.join(os.tmpdir(), 'md-journal-test-'));

        await vscode.workspace.getConfiguration('md-journal').update('journalPath', testJournalPath, vscode.ConfigurationTarget.Global);
        await new Promise(resolve => setTimeout(resolve, 500)); // wait for config propagation

        const api = await extension.activate();

        const file1Path = path.join(testJournalPath, 'file1.md');
        fs.writeFileSync(file1Path, 'This is a test file with a #tag1 and a [[link1]].');

        const file2Path = path.join(testJournalPath, 'file2.md');
        fs.writeFileSync(file2Path, 'This is another test file with a #tag2 and a [[link2]].');

        await api.indexService.setJournalPath(testJournalPath);

        const tag1Files = api.indexService.getFilesForTag('tag1');
        assert.strictEqual(tag1Files.length, 1, 'tag1 should have one file');
        assert.strictEqual(tag1Files[0], file1Path, 'tag1 file path should be correct');

        const tag2Files = api.indexService.getFilesForTag('tag2');
        assert.strictEqual(tag2Files.length, 1, 'tag2 should have one file');
        assert.strictEqual(tag2Files[0], file2Path, 'tag2 file path should be correct');

        const backlinksToLink1 = api.indexService.getBacklinks(path.join(testJournalPath, 'link1.md'));
        assert.strictEqual(backlinksToLink1.length, 1, 'link1 should have one backlink');
        assert.strictEqual(backlinksToLink1[0], file1Path, 'link1 backlink path should be correct');

        fs.rmSync(testJournalPath, { recursive: true, force: true });
    }).timeout(10000);

    test('Should prompt and set folder when journal path is empty', async () => {
        await vscode.workspace.getConfiguration('md-journal').update('journalPath', '', vscode.ConfigurationTarget.Global);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        let warningMessageShown = false;
        let openDialogShown = false;
        
        const originalShowWarningMessage = vscode.window.showWarningMessage;
        const originalShowOpenDialog = vscode.window.showOpenDialog;
        const dummyPath = path.join(os.tmpdir(), 'dummy-journal-test-');
        
        try {
            vscode.window.showWarningMessage = (async (msg: string, ...items: string[]) => {
                warningMessageShown = true;
                return 'Set Journal Folder';
            }) as any;

            vscode.window.showOpenDialog = (async () => {
                openDialogShown = true;
                return [vscode.Uri.file(dummyPath)];
            }) as any;
            
            await vscode.commands.executeCommand('md-journal.newDailyEntry');
            
            assert.strictEqual(warningMessageShown, true, 'Warning message should be shown');
            assert.strictEqual(openDialogShown, true, 'Open dialog should be shown');
            
            const newConfig = vscode.workspace.getConfiguration('md-journal').inspect<string>('journalPath');
            assert.strictEqual(newConfig?.globalValue?.toLowerCase(), dummyPath.toLowerCase(), 'Configuration should be updated to dummy path');
        } finally {
            vscode.window.showWarningMessage = originalShowWarningMessage;
            vscode.window.showOpenDialog = originalShowOpenDialog;
            try { fs.rmSync(dummyPath, { recursive: true, force: true }); } catch (e) { }
        }
    }).timeout(10000);

    test('Should handle rename collisions without overwriting by default', async () => {
        const testJournalPath = fs.mkdtempSync(path.join(os.tmpdir(), 'md-journal-test-2-'));
        await vscode.workspace.getConfiguration('md-journal').update('journalPath', testJournalPath, vscode.ConfigurationTarget.Global);
        await new Promise(resolve => setTimeout(resolve, 500));

        const fileA = path.join(testJournalPath, 'fileA.md');
        const fileB = path.join(testJournalPath, 'fileB.md');
        fs.writeFileSync(fileA, 'A');
        fs.writeFileSync(fileB, 'B');

        const document = await vscode.workspace.openTextDocument(fileA);
        await vscode.window.showTextDocument(document);

        let inputShown = false;
        let warningShown = false;

        const originalShowInputBox = vscode.window.showInputBox;
        const originalShowWarningMessage = vscode.window.showWarningMessage;

        try {
            vscode.window.showInputBox = (async () => {
                inputShown = true;
                return 'fileB';
            }) as any;

            vscode.window.showWarningMessage = (async (msg: string, options: any, ...items: string[]) => {
                warningShown = true;
                return 'Cancel';
            }) as any;

            await vscode.commands.executeCommand('md-journal.renameEntry');

            assert.strictEqual(inputShown, true, 'Input box should be shown for rename');
            assert.strictEqual(warningShown, true, 'Warning should be shown for collision');
            
            assert.strictEqual(fs.existsSync(fileA), true, 'fileA should still exist');
            assert.strictEqual(fs.existsSync(fileB), true, 'fileB should still exist');

        } finally {
            vscode.window.showInputBox = originalShowInputBox;
            vscode.window.showWarningMessage = originalShowWarningMessage;
            
            await vscode.commands.executeCommand('workbench.action.closeAllEditors');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            try { fs.rmSync(testJournalPath, { recursive: true, force: true }); } catch (e) { console.error(e); }
        }
    }).timeout(10000);
});