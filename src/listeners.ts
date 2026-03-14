import * as vscode from 'vscode';
import * as path from 'path';
import { IndexService } from './services/IndexService';
import { sanitizeFileName } from './string';
import { getJournalFolderPath } from './date';

export function registerListeners(
    context: vscode.ExtensionContext,
    journalPath: string,
    indexService: IndexService,
    statusBarItem: vscode.StatusBarItem,
    folderStructure: string
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    disposables.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === 'markdown' && document.uri.fsPath.startsWith(journalPath)) {
            if (path.basename(document.fileName) === 'daily-note.md') {
                const firstLine = document.lineAt(0).text;
                if (!firstLine.trim()) {
                    return;
                }

                const newFileName = sanitizeFileName(firstLine) + '.md';
                const newFilePath = path.join(path.dirname(document.fileName), newFileName);

                await vscode.window.showTextDocument(document, { preview: true, preserveFocus: false });
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

                await vscode.workspace.fs.rename(document.uri, vscode.Uri.file(newFilePath));

                const newDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(newFilePath));
                vscode.window.showTextDocument(newDocument);
                indexService.updateIndexForFile(newFilePath);
            } else {
                indexService.updateIndexForFile(document.uri.fsPath);
            }
        }
    }));

    disposables.push(vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar(statusBarItem, folderStructure, journalPath)));

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

export async function updateStatusBar(statusBarItem: vscode.StatusBarItem, folderStructure: string, journalPath: string) {
    if (!journalPath) {
        statusBarItem.hide();
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