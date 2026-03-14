import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

suite('Extension Test Suite', () => {
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

        fs.unlinkSync(file1Path);
        fs.unlinkSync(file2Path);
        fs.rmdirSync(testJournalPath);
    }).timeout(10000);
});