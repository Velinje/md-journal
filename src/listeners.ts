import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
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

                await fs.promises.rename(document.fileName, newFilePath);

                const newDocument = await vscode.workspace.openTextDocument(newFilePath);
                vscode.window.showTextDocument(newDocument);
                indexService.updateIndexForFile(newFilePath);
            } else {
                indexService.updateIndexForFile(document.uri.fsPath);
            }
        }
    }));

    disposables.push(vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar(statusBarItem, folderStructure, journalPath)));

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    const onFileChange = (uri: vscode.Uri) => {
        indexService.updateIndexForFile(uri.fsPath);
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
        const files = await fs.promises.readdir(folderPath);
        hasTodayNote = files.some(file => file.endsWith('.md'));
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