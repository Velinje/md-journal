import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { JournalTreeViewProvider } from './JournalTreeView';
import { TagIndexManager } from './TagIndexManager';
import { LinkIndexManager } from './LinkIndexManager';
import { BacklinksTreeViewProvider } from './BacklinksTreeView';
import { TagTreeViewProvider } from './TagTreeView';
import { sanitizeFileName } from './string';
import { getJournalFolderPath } from './date';

export function registerListeners(
    context: vscode.ExtensionContext,
    journalPath: string,
    journalTreeViewProvider: JournalTreeViewProvider,
    tagIndexManager: TagIndexManager,
    linkIndexManager: LinkIndexManager,
    backlinksTreeViewProvider: BacklinksTreeViewProvider,
    tagTreeViewProvider: TagTreeViewProvider,
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

                fs.renameSync(document.fileName, newFilePath);

                const newDocument = await vscode.workspace.openTextDocument(newFilePath);
                vscode.window.showTextDocument(newDocument);
                journalTreeViewProvider.refresh();
                tagIndexManager.updateIndexForFile(newFilePath);
                tagTreeViewProvider.refresh();
                linkIndexManager.updateIndexForFile(newFilePath);
                backlinksTreeViewProvider.refresh(newFilePath);
            } else {
                tagIndexManager.updateIndexForFile(document.uri.fsPath);
                tagTreeViewProvider.refresh();
                linkIndexManager.updateIndexForFile(document.uri.fsPath);
                backlinksTreeViewProvider.refresh(document.uri.fsPath);
            }
        }
    }));

    disposables.push(vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar(statusBarItem, folderStructure, journalPath)));

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    const onFileChange = (uri: vscode.Uri) => {
        tagIndexManager.updateIndexForFile(uri.fsPath);
        linkIndexManager.updateIndexForFile(uri.fsPath);
        journalTreeViewProvider.refresh();
        tagTreeViewProvider.refresh();
        backlinksTreeViewProvider.refresh();
    };
    watcher.onDidChange(onFileChange);
    watcher.onDidCreate(onFileChange);
    watcher.onDidDelete(onFileChange);
    disposables.push(watcher);

    disposables.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor && editor.document.languageId === 'markdown' && editor.document.uri.fsPath.startsWith(journalPath)) {
            backlinksTreeViewProvider.refresh(editor.document.uri.fsPath);
        } else {
            backlinksTreeViewProvider.refresh();
        }
    }));

    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'markdown' && vscode.window.activeTextEditor.document.uri.fsPath.startsWith(journalPath)) {
        backlinksTreeViewProvider.refresh(vscode.window.activeTextEditor.document.uri.fsPath);
    }

    return disposables;
}

export function updateStatusBar(statusBarItem: vscode.StatusBarItem, folderStructure: string, journalPath: string) {
    if (!journalPath) {
        statusBarItem.hide();
        return;
    }

    const today = new Date();
    const folderPath = path.join(journalPath, getJournalFolderPath(today, folderStructure));

    if (fs.existsSync(folderPath) && fs.readdirSync(folderPath).filter(file => file.endsWith('.md')).length > 0) {
        statusBarItem.text = `$(check) Today's Note`;
        statusBarItem.command = 'md-journal.goToTodaysNote';
        statusBarItem.show();
    } else {
        statusBarItem.text = `$(add) New Note`;
        statusBarItem.command = 'md-journal.newDailyEntry';
        statusBarItem.show();
    }
}