import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const newDailyEntryCommand = vscode.commands.registerCommand('md-journal.newDailyEntry', async () => {
        const journalPath = await getJournalPath();
        if (!journalPath) {
            return;
        }

        const dateFormat = await getDateFormat();
        if (!dateFormat) {
            return;
        }

        const today = new Date();
        const folderName = getFormattedDate(today, dateFormat);
        const folderPath = path.join(journalPath, folderName);

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        const fileName = 'daily-note.md';
        const filePath = path.join(folderPath, fileName);

        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, `# ${getFormattedDate(today, dateFormat)}

`);
        }

        const document = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(document);
    });

    const goToTodaysNoteCommand = vscode.commands.registerCommand('md-journal.goToTodaysNote', async () => {
        const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath');
        const dateFormat = vscode.workspace.getConfiguration('md-journal').get<string>('dateFormat');

        if (!journalPath || !dateFormat) {
            vscode.window.showInformationMessage('Journal path not set. Please run "Journal: New Daily Entry" first.');
            return;
        }

        const today = new Date();
        const folderName = getFormattedDate(today, dateFormat);
        const folderPath = path.join(journalPath, folderName);

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
        }
    });

    context.subscriptions.push(newDailyEntryCommand, goToTodaysNoteCommand, onDidSaveTextDocumentListener);
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

async function getDateFormat(): Promise<string | undefined> {
    let dateFormat = vscode.workspace.getConfiguration('md-journal').get<string>('dateFormat');

    if (!dateFormat) {
        const result = await vscode.window.showInputBox({
            prompt: 'Enter the date format for your daily folders.',
            value: 'YYYY-MM-DD'
        });

        if (result) {
            dateFormat = result;
            await vscode.workspace.getConfiguration('md-journal').update('dateFormat', dateFormat, vscode.ConfigurationTarget.Global);
        } else {
            return undefined;
        }
    }
    return dateFormat;
}

function getFormattedDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day);
}

function sanitizeFileName(name: string): string {
    // Remove markdown heading characters and other invalid filename characters
    const sanitized = name.replace(/^[#\s]+/, '').replace(/[<>:"/\\|?*]/g, '');
    return sanitized.replace(/\s/g, '-').toLowerCase();
}

export function deactivate() {}