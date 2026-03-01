import * as vscode from 'vscode';

export function getJournalPath(): string {
    return vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
}

export function getFolderStructure(): string {
    return vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MMMM/DD-dddd');
}

export function getFileHeaderFormat(): string {
    return vscode.workspace.getConfiguration('md-journal').get<string>('fileHeaderFormat', 'YYYY-MM-DD HH:mm:ss');
}
