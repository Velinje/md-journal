import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { JournalTreeViewProvider } from './JournalTreeView';
import { TagIndexManager } from './TagIndexManager';
import { LinkIndexManager } from './LinkIndexManager';
import { BacklinksTreeViewProvider } from './BacklinksTreeView';
import { getJournalFolderPath, getFormattedTimestamp } from './date';
import { sanitizeFileName } from './string';
import { updateStatusBar } from './listeners';
import { getFileHeaderFormat, getJournalPath as getJournalPathSetting } from './settings';
import { getAllMarkdownFiles } from './filesystem';

export function registerCommands(
    context: vscode.ExtensionContext,
    journalPath: string,
    journalTreeViewProvider: JournalTreeViewProvider,
    tagIndexManager: TagIndexManager,
    linkIndexManager: LinkIndexManager,
    backlinksTreeViewProvider: BacklinksTreeViewProvider,
    statusBarItem: vscode.StatusBarItem,
    getJournalPath: (force?: boolean) => Promise<string | undefined>,
    folderStructure: string
) {
    const disposables: vscode.Disposable[] = [];

    disposables.push(vscode.commands.registerCommand('md-journal.newDailyEntry', async () => {
        const journalPath = await getJournalPath();
        if (!journalPath) {
            return;
        }

        const templateFolder = path.join(journalPath, '.templates');
        if (!fs.existsSync(templateFolder)) {
            fs.mkdirSync(templateFolder, { recursive: true });
        }

        const templates = fs.readdirSync(templateFolder).filter(file => file.endsWith('.md'));
        let selectedTemplateContent = '';

        if (templates.length > 0) {
            const templateQuickPickItems = templates.map(template => ({ label: path.basename(template, '.md'), description: template }));
            const selectedTemplate = await vscode.window.showQuickPick(templateQuickPickItems, { placeHolder: 'Select a template or press Esc for a blank note' });

            if (selectedTemplate) {
                selectedTemplateContent = fs.readFileSync(path.join(templateFolder, selectedTemplate.description), 'utf8');
            }
        }

        const today = new Date();
        const fullFolderPath = path.join(journalPath, getJournalFolderPath(today, folderStructure));

        if (!fs.existsSync(fullFolderPath)) {
            fs.mkdirSync(fullFolderPath, { recursive: true });
        }

        const fileName = 'daily-note.md';
        const filePath = path.join(fullFolderPath, fileName);

        let fileContent = '';
        if (selectedTemplateContent) {
            const fileHeaderFormat = getFileHeaderFormat();
            fileContent = selectedTemplateContent.replace(/\{date\}/g, getFormattedTimestamp(today, fileHeaderFormat));
        } else {
            const fileHeaderFormat = getFileHeaderFormat();
            fileContent = `# ${getFormattedTimestamp(today, fileHeaderFormat)}\n\n`;
        }

        fs.writeFileSync(filePath, fileContent);
        journalTreeViewProvider.refresh();

        const document = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(document);
        updateStatusBar(statusBarItem, folderStructure, journalPath);
        tagIndexManager.updateIndexForFile(filePath);
        linkIndexManager.updateIndexForFile(filePath);
        backlinksTreeViewProvider.refresh(filePath);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.saveAsTemplate', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found.');
            return;
        }

        const journalPath = getJournalPathSetting();
        if (!journalPath) {
            vscode.window.showInformationMessage('Journal path not configured. Please configure it in settings.');
            return;
        }

        const templateFolder = path.join(journalPath, '.templates');
        if (!fs.existsSync(templateFolder)) {
            fs.mkdirSync(templateFolder, { recursive: true });
        }

        const templateName = await vscode.window.showInputBox({
            prompt: 'Enter template name (e.g., meeting-notes)',
            value: path.basename(editor.document.fileName, '.md')
        });

        if (!templateName) {
            return;
        }

        let contentToSave = editor.document.getText();
        const firstLine = editor.document.lineAt(0).text;
        const fileHeaderFormat = getFileHeaderFormat();
        const regex = new RegExp(`^# ${getFormattedTimestamp(new Date(), fileHeaderFormat.replace(/[-/\\^$*+?.()|[\\\]{}]/g, '\\$&'))}`);

        if (regex.test(firstLine)) {
            contentToSave = editor.document.getText().substring(editor.document.lineAt(0).rangeIncludingLineBreak.end.character);
        }

        const templateFilePath = path.join(templateFolder, `${templateName}.md`);
        fs.writeFileSync(templateFilePath, contentToSave);
        vscode.window.showInformationMessage(`Template '${templateName}' saved successfully!`);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.goToTodaysNote', async () => {
        const journalPath = getJournalPathSetting();

        const today = new Date();
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
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.refreshEntries', () => {
        journalTreeViewProvider.refresh();
        updateStatusBar(statusBarItem, folderStructure, journalPath);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.searchEntries', async () => {
        const currentJournalPath = getJournalPathSetting();
        if (!currentJournalPath) { return; }
        const files = await getAllMarkdownFiles(currentJournalPath);
        if (files.length === 0) {
            vscode.window.showInformationMessage('No journal entries found.');
            return;
        }

        const items = files.map(file => {
            const relativePath = path.relative(currentJournalPath, file);
            return {
                label: path.basename(file, '.md'),
                description: relativePath,
                file: file
            };
        });

        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Search journal entries...' });
        if (selected) {
            const document = await vscode.workspace.openTextDocument(selected.file);
            vscode.window.showTextDocument(document);
        }
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.renameEntry', async (node?: vscode.TreeItem) => {
        if (!node || !node.resourceUri) { return; }

        const uri = node.resourceUri;
        const oldName = path.basename(uri.fsPath, '.md');
        const newName = await vscode.window.showInputBox({
            prompt: 'Enter new name for the entry',
            value: oldName
        });

        if (!newName || newName === oldName) { return; }

        const newFileName = newName.endsWith('.md') ? newName : `${newName}.md`;
        const newUri = vscode.Uri.file(path.join(path.dirname(uri.fsPath), newFileName));

        try {
            await vscode.workspace.fs.rename(uri, newUri);
            journalTreeViewProvider.refresh();
            tagIndexManager.updateIndexForFile(uri.fsPath, false);
            tagIndexManager.updateIndexForFile(newUri.fsPath, true);
            linkIndexManager.updateIndexForFile(uri.fsPath, false);
            linkIndexManager.updateIndexForFile(newUri.fsPath, true);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename file: ${error}`);
        }
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.deleteEntry', async (node?: vscode.TreeItem) => {
        if (!node || !node.resourceUri) { return; }

        const uri = node.resourceUri;
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete ${path.basename(uri.fsPath)}?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                await vscode.workspace.fs.delete(uri);
                journalTreeViewProvider.refresh();
                tagIndexManager.updateIndexForFile(uri.fsPath, true);
                linkIndexManager.updateIndexForFile(uri.fsPath, true);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete file: ${error}`);
            }
        }
    }));

    return disposables;
}