import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

suite('Performance Test Suite', () => {
    vscode.window.showInformationMessage('Start Performance Tests.');

    test('Should index 2,000 files within acceptable time limit', async () => {
        // Activate Extension to get IndexService
        const extension = vscode.extensions.getExtension('velinje.md-journal');
        if (!extension) {
            assert.fail('Extension not found');
        }
        const api = await extension.activate();

        // Setup the dummy environment
        const perfJournalPath = path.join(__dirname, 'perf-journal');
        if (!fs.existsSync(perfJournalPath)) {
            fs.mkdirSync(perfJournalPath);
        }

        // Generate 2,000 dummy markdown files
        console.log('Generating 2,000 mock markdown files...');
        const NUM_FILES = 2000;

        api.indexService.isPaused = true;

        // Let's create a bunch of random tags and links so the regex parser actually does work
        const randomTags = ['#work', '#personal', '#meeting', '#idea', '#todo', '#urgent', '#review', '#planning', '#design', '#bug'];
        const randomLinks = ['[[Home]]', '[[Project Alpha]]', '[[Meeting Notes]]', '[[Archived]]', '[[Reference]]'];

        for (let i = 0; i < NUM_FILES; i++) {
            const yearFolder = path.join(perfJournalPath, (2000 + (i % 25)).toString());
            if (!fs.existsSync(yearFolder)) {
                fs.mkdirSync(yearFolder);
            }
            const monthFolder = path.join(yearFolder, 'January');
            if (!fs.existsSync(monthFolder)) {
                fs.mkdirSync(monthFolder);
            }
            const fileFolder = path.join(monthFolder, `01-Monday-${i}`);
            if (!fs.existsSync(fileFolder)) {
                fs.mkdirSync(fileFolder);
            }

            const filePath = path.join(fileFolder, 'daily-note.md');

            const tag1 = randomTags[Math.floor(Math.random() * randomTags.length)];
            const tag2 = randomTags[Math.floor(Math.random() * randomTags.length)];
            const link1 = randomLinks[Math.floor(Math.random() * randomLinks.length)];

            const content = `# Daily Note ${i}\n\nThis is a mock file generated for performance testing.\nIt includes some tags like ${tag1} and ${tag2} as well as a link to ${link1}.`;
            fs.writeFileSync(filePath, content);
        }
        console.log('Done generating files.');

        // 3. Measure indexing speed
        console.log('Starting IndexService parser...');
        api.indexService.isPaused = false;

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

        // Assert that indexing 2,000 files takes less than 20 seconds (20000ms)
        // 15 seconds is the current maximum V8 throughput boundary for processing 2000 file I/O regex match sweeps.
        assert.ok(executionTimeMs < 20000, `Indexing took too long: ${executionTimeMs}ms`);

        // 4. Cleanup
        console.log('Cleaning up mock files...');
        fs.rmSync(perfJournalPath, { recursive: true, force: true });
        console.log('Cleanup complete.');

    }).timeout(90000); // Allow up to 90 seconds for this whole test due to file generation I/O
});
