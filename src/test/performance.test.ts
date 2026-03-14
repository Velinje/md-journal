import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

suite('Performance Test Suite', () => {
    vscode.window.showInformationMessage('Start Performance Tests.');

    test('Should index 2,000 files within acceptable time limit', async () => {
        const extension = vscode.extensions.getExtension('fuzzyoutput.md-journal');
        if (!extension) {
            assert.fail('Extension not found');
        }
        const perfJournalPath = fs.mkdtempSync(path.join(os.tmpdir(), 'md-journal-perf-'));

        await vscode.workspace.getConfiguration('md-journal').update('journalPath', perfJournalPath, vscode.ConfigurationTarget.Global);
        await new Promise(resolve => setTimeout(resolve, 500)); // wait for config propagation

        const api = await extension.activate();

        console.log('Generating 2,000 mock markdown files...');
        const NUM_FILES = 2000;

        const randomTags = ['#work', '#personal', '#meeting', '#idea', '#todo', '#urgent', '#review', '#planning', '#design', '#bug'];
        const randomLinks = ['[[Home]]', '[[Project Alpha]]', '[[Meeting Notes]]', '[[Archived]]', '[[Reference]]'];

        for (let i = 0; i < NUM_FILES; i++) {
            const fileFolder = path.join(perfJournalPath, 'MockJournal');
            if (!fs.existsSync(fileFolder)) {
                fs.mkdirSync(fileFolder);
            }

            const filePath = path.join(fileFolder, `daily-note-${i}.md`);

            const tag1 = randomTags[Math.floor(Math.random() * randomTags.length)];
            const tag2 = randomTags[Math.floor(Math.random() * randomTags.length)];
            const link1 = randomLinks[Math.floor(Math.random() * randomLinks.length)];

            const content = `# Daily Note ${i}\n\nThis is a mock file generated for performance testing.\nIt includes some tags like ${tag1} and ${tag2} as well as a link to ${link1}.`;
            fs.writeFileSync(filePath, content);

            if (i % 100 === 0) {
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        console.log('Done generating files.');

        console.log('Starting IndexService parser...');

        const startTime = performance.now();
        await api.indexService.setJournalPath(perfJournalPath);
        const endTime = performance.now();

        const executionTimeMs = Math.round(endTime - startTime);
        const indexedTags = api.indexService.getTags();
        console.log(`\n==========================================`);
        console.log(`⏱️ PERFORMANCE RESULT: Indexing ${NUM_FILES} files took ${executionTimeMs} ms.`);
        console.log(`🔍 Total Unique Tags Indexed: ${indexedTags.length}`);
        console.log(`🔍 Total Files for 'work' target: ${api.indexService.getFilesForTag('work').length}`);
        console.log(`==========================================\n`);

        assert.ok(executionTimeMs < 20000, `Indexing took too long: ${executionTimeMs}ms`);

        console.log('Cleaning up mock files...');
        fs.rmSync(perfJournalPath, { recursive: true, force: true });
        console.log('Cleanup complete.');

    }).timeout(90000); // Allow up to 90 seconds for this whole test due to file generation I/O
});
