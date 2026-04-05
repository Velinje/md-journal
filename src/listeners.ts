import * as vscode from 'vscode';
import * as path from 'path';
import { IndexService } from './services/IndexService';
import { sanitizeFileName } from './string';
import { getJournalFolderPath } from './date';
import { getJournalPath, getFolderStructure } from './settings';

export function registerListeners(
    context: vscode.ExtensionContext,
    indexService: IndexService,
    statusBarItem: vscode.StatusBarItem,
    log: vscode.OutputChannel
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    disposables.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === 'markdown') {
            const journalPath = getJournalPath();
            if (!journalPath) { return; }

            const normalizedDoc = path.resolve(document.uri.fsPath).toLowerCase();
            let normalizedJournal = path.resolve(journalPath).toLowerCase();
            if (normalizedJournal.endsWith(path.sep)) {
                normalizedJournal = normalizedJournal.slice(0, -1);
            }
            const isInsideJournal = normalizedDoc.startsWith(normalizedJournal + path.sep);

            if (isInsideJournal) {
                const basename = path.basename(document.fileName);
                if (basename.toLowerCase() === 'daily-note.md') {
                    try {
                        const firstLine = document.lineAt(0).text;
                        if (!firstLine.trim()) { return; }

                        const newFileName = sanitizeFileName(firstLine) + '.md';
                        if (!newFileName || newFileName === '.md') { return; }

                        const newFilePath = path.join(path.dirname(document.fileName), newFileName);

                        // Skip if already correctly named (handles case-only differences on Windows)
                        if (newFilePath.toLowerCase() === document.fileName.toLowerCase()) { return; }

                        // Check for collision — don't silently overwrite an existing file
                        try {
                            await vscode.workspace.fs.stat(vscode.Uri.file(newFilePath));
                            vscode.window.showWarningMessage(
                                `MD Journal: Could not rename — a file named '${newFileName}' already exists in this folder.`
                            );
                            return;
                        } catch {
                            // File does not exist, safe to proceed
                        }

                        await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false });
                        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                        await vscode.workspace.fs.rename(document.uri, vscode.Uri.file(newFilePath));

                        const newDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(newFilePath));
                        vscode.window.showTextDocument(newDocument);
                        indexService.updateIndexForFile(newFilePath);
                    } catch (err: any) {
                        log.appendLine(`Rename error: ${err.message ?? err}`);
                        vscode.window.showErrorMessage(`MD Journal: Failed to rename entry — ${err.message ?? err}`);
                    }
                } else {
                    indexService.updateIndexForFile(document.uri.fsPath);
                }
            }
        }
    }));

    disposables.push(vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar(statusBarItem)));

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');

    const pendingChanges = new Set<string>();
    let debounceTimer: NodeJS.Timeout | null = null;

    const processPendingChanges = async () => {
        const filesToProcess = Array.from(pendingChanges);
        pendingChanges.clear();
        for (const filePath of filesToProcess) {
            await indexService.updateIndexForFile(filePath, false);
        }
        if (filesToProcess.length > 0) {
            await indexService.triggerSaveAndFire();
        }
    };

    const onFileChange = (uri: vscode.Uri) => {
        pendingChanges.add(uri.fsPath);
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(processPendingChanges, 300);
    };

    watcher.onDidChange(onFileChange);
    watcher.onDidCreate(onFileChange);
    watcher.onDidDelete(onFileChange);
    disposables.push(watcher);

    return disposables;
}

export async function updateStatusBar(statusBarItem: vscode.StatusBarItem) {
    const journalPath = getJournalPath();
    const folderStructure = getFolderStructure();
    if (!journalPath) {
        statusBarItem.text = `$(gear) Setup MD Journal`;
        statusBarItem.command = 'md-journal.newDailyEntry';
        statusBarItem.show();
        return;
    }

    const today = new Date();
    const folderPath = path.join(journalPath, getJournalFolderPath(today, folderStructure));

    let hasTodayNote = false;
    try {
        const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(folderPath));
        hasTodayNote = files.some(([file, type]) => file.endsWith('.md') && type === vscode.FileType.File);
    } catch { }

    if (hasTodayNote) {
        statusBarItem.text = `$(check) Today's Note`;
        statusBarItem.command = 'md-journal.goToTodaysNote';
        statusBarItem.show();
    } else {
        statusBarItem.text = `$(add) New Note`;
        statusBarItem.command = 'md-journal.newDailyEntry';
        statusBarItem.show();
    }
}