import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { JournalTreeViewProvider } from './JournalTreeView';

export function activate(context: vscode.ExtensionContext) {
    const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
    const journalTreeViewProvider = new JournalTreeViewProvider(journalPath);
    vscode.window.registerTreeDataProvider('md-journal-entries', journalTreeViewProvider);

    const newDailyEntryCommand = vscode.commands.registerCommand('md-journal.newDailyEntry', async () => {
        const journalPath = await getJournalPath();
        if (!journalPath) {
            return;
        }
        journalTreeViewProvider.updateJournalPath(journalPath);

        

        const today = new Date();
        const folderStructure = vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MM-DD');
        const fullFolderPath = path.join(journalPath, getJournalFolderPath(today, folderStructure));

        if (!fs.existsSync(fullFolderPath)) {
            fs.mkdirSync(fullFolderPath, { recursive: true });
        }

        const fileName = 'daily-note.md';
        const filePath = path.join(fullFolderPath, fileName);

        if (!fs.existsSync(filePath)) {
            const fileHeaderFormat = vscode.workspace.getConfiguration('md-journal').get<string>('fileHeaderFormat', 'YYYY-MM-DD HH:mm:ss');
            fs.writeFileSync(filePath, `# ${getFormattedTimestamp(today, fileHeaderFormat)}

`);
            journalTreeViewProvider.refresh();
        }

        const document = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(document);
    });

    const goToTodaysNoteCommand = vscode.commands.registerCommand('md-journal.goToTodaysNote', async () => {
        const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
        

        const today = new Date();
        const folderStructure = vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MM-DD');
        const folderPath = path.join(journalPath, getJournalFolderPath(today, folderStructure));

        if (!fs.existsSync(folderPath)) {
            const selection = await vscode.window.showInformationMessage('No note found for today.', 'Create One');
            if (selection === 'Create One') {
                vscode.commands.executeCommand('md-journal.newDailyEntry');
            }
            return;
        }

        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.md'));

        if (files.length === 0) {
             const selection = await vscode.window.showInformationMessage('No note found for today.', 'Create One');
            if (selection === 'Create One') {
                vscode.commands.executeCommand('md-journal.newDailyEntry');
            }
            return;
        } else if (files.length === 1) {
            const filePath = path.join(folderPath, files[0]);
            const document = await vscode.workspace.openTextDocument(filePath);
            vscode.window.showTextDocument(document);
        } else {
            const result = await vscode.window.showQuickPick(files, { placeHolder: 'Select a note to open' });
            if (result) {
                const filePath = path.join(folderPath, result);
                const document = await vscode.workspace.openTextDocument(filePath);
                vscode.window.showTextDocument(document);
            }
        }
    });

    const onDidSaveTextDocumentListener = vscode.workspace.onDidSaveTextDocument(async (document) => {
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
        }
    });

    const refreshEntriesCommand = vscode.commands.registerCommand('md-journal.refreshEntries', () => {
        journalTreeViewProvider.refresh();
    });

    context.subscriptions.push(newDailyEntryCommand, goToTodaysNoteCommand, onDidSaveTextDocumentListener, refreshEntriesCommand);
}

async function getJournalPath(): Promise<string | undefined> {
    let journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath');

    if (!journalPath) {
        const result = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Journal Folder'
        });

        if (result && result.length > 0) {
            journalPath = result[0].fsPath;
            await vscode.workspace.getConfiguration('md-journal').update('journalPath', journalPath, vscode.ConfigurationTarget.Global);
        } else {
            return undefined;
        }
    }
    return journalPath;
}



function getFormattedTimestamp(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

function getJournalFolderPath(date: Date, folderStructure: string): string {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    let folderPath = folderStructure
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);

    // Replace any custom separators (like '>') with the system's path separator
    folderPath = folderPath.replace(/>/g, path.sep);

    return folderPath;
}

function sanitizeFileName(name: string): string {
    // Remove markdown heading characters and other invalid filename characters
    const sanitized = name.replace(/^[#\s]+/, '').replace(/[<>:"/\\|?*]/g, '');
    return sanitized.replace(/\s/g, '-').toLowerCase();
}

export function deactivate() {}