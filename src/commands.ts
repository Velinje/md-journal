import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { JournalTreeViewProvider } from './JournalTreeView';
import { IndexService } from './services/IndexService';
import { BacklinksTreeViewProvider } from './BacklinksTreeView';
import { getJournalFolderPath, getFormattedTimestamp } from './date';
import { sanitizeFileName } from './string';
import { updateStatusBar } from './listeners';
import { getFileHeaderFormat, getJournalPath, verifyJournalPath, getFolderStructure } from './settings';
import { getAllMarkdownFiles } from './filesystem';

export function registerCommands(
    context: vscode.ExtensionContext,
    journalTreeViewProvider: JournalTreeViewProvider,
    indexService: IndexService,
    backlinksTreeViewProvider: BacklinksTreeViewProvider,
    statusBarItem: vscode.StatusBarItem,
) {
    const disposables: vscode.Disposable[] = [];

    const setJournalPathCommand = async () => {
        const suggestedUri = vscode.Uri.file(path.join(os.homedir(), 'md-journal'));
        const uris = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            title: 'Select your MD Journal folder',
            openLabel: 'Set as Journal Folder',
            defaultUri: suggestedUri,
        });

        if (uris && uris.length > 0) {
            const newPath = uris[0].fsPath;
            await vscode.workspace.getConfiguration('md-journal').update('journalPath', newPath, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Journal folder set to: ${newPath}`);
            return newPath;
        }
        return undefined;
    };

    const ensureValidPath = async (): Promise<string | undefined> => {
        const jPath = getJournalPath();

        if (!jPath) {
            const choice = await vscode.window.showWarningMessage(
                'MD Journal: No journal folder has been configured.',
                'Set Journal Folder'
            );
            if (choice === 'Set Journal Folder') {
                return await setJournalPathCommand();
            }
            return undefined;
        }

        const isValid = await verifyJournalPath(jPath);
        if (isValid) {
            return jPath;
        }

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(jPath));
            return jPath;
        } catch (error) {
            const selection = await vscode.window.showErrorMessage(
                `Failed to access or create MD Journal folder at '${jPath}'. Please select a different location.`,
                { modal: true },
                'Set Folder'
            );
            if (selection === 'Set Folder') {
                return await setJournalPathCommand();
            }
            return undefined;
        }
    };

    const isWithinJournalPath = (candidateUri: vscode.Uri, journalPath: string): boolean => {
        if (candidateUri.scheme !== 'file') {
            return false;
        }

        const journalRoot = path.resolve(journalPath);
        const candidatePath = path.resolve(candidateUri.fsPath);
        const relativePath = path.relative(journalRoot, candidatePath);

        return relativePath !== ''
            ? relativePath.split(path.sep)[0] !== '..' && !path.isAbsolute(relativePath)
            : true;
    };

    const resolveContextUri = async (arg?: any): Promise<vscode.Uri | undefined> => {
        const currentJournalPath = await ensureValidPath();
        if (!currentJournalPath) { return undefined; }

        let uri: vscode.Uri | undefined;

        if (arg && arg.resourceUri && isWithinJournalPath(arg.resourceUri, currentJournalPath)) {
            uri = arg.resourceUri;
        } else if (arg instanceof vscode.Uri && isWithinJournalPath(arg, currentJournalPath)) {
            uri = arg;
        } else if (
            vscode.window.activeTextEditor?.document.languageId === 'markdown' &&
            isWithinJournalPath(vscode.window.activeTextEditor.document.uri, currentJournalPath)
        ) {
            uri = vscode.window.activeTextEditor.document.uri;
        }

        if (!uri) {

            const files = await getAllMarkdownFiles(currentJournalPath);
            if (files.length === 0) {
                vscode.window.showInformationMessage('No journal entries found.');
                return undefined;
            }

            const items = files.map(file => ({
                label: path.basename(file, '.md'),
                description: path.relative(currentJournalPath, file),
                file: file
            }));

            const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a journal entry to target...' });
            if (selected) {
                uri = vscode.Uri.file(selected.file);
            }
        }

        return uri;
    };

    disposables.push(vscode.commands.registerCommand('md-journal.setPath', setJournalPathCommand));

    disposables.push(vscode.commands.registerCommand('md-journal.newDailyEntry', async () => {
        const journalPath = await ensureValidPath();
        if (!journalPath) { return; }

        const templateFolder = path.join(journalPath, '.templates');
        if (!fs.existsSync(templateFolder)) {
            await fs.promises.mkdir(templateFolder, { recursive: true });
        }

        const templates = (await fs.promises.readdir(templateFolder)).filter(f => f.endsWith('.md'));
        let selectedTemplateContent = '';

        if (templates.length > 0) {
            const items = templates.map(t => ({ label: path.basename(t, '.md'), description: t }));
            const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Select a template or press Esc for a blank note' });
            if (selected) {
                selectedTemplateContent = await fs.promises.readFile(path.join(templateFolder, selected.description), 'utf8');
            }
        }

        const today = new Date();
        const fullFolderPath = path.join(journalPath, getJournalFolderPath(today, getFolderStructure()));
        if (!fs.existsSync(fullFolderPath)) {
            await fs.promises.mkdir(fullFolderPath, { recursive: true });
        }

        const filePath = path.join(fullFolderPath, 'daily-note.md');
        const fileHeaderFormat = getFileHeaderFormat();
        const fileContent = selectedTemplateContent
            ? selectedTemplateContent.replace(/\{date\}/g, getFormattedTimestamp(today, fileHeaderFormat))
            : `# ${getFormattedTimestamp(today, fileHeaderFormat)}\n\n`;

        await fs.promises.writeFile(filePath, fileContent);
        journalTreeViewProvider.refresh();

        const document = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(document);
        await updateStatusBar(statusBarItem);
        indexService.updateIndexForFile(filePath);
        backlinksTreeViewProvider.refresh(filePath);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.saveAsTemplate', async (arg?: any) => {
        const uri = await resolveContextUri(arg);
        if (!uri) { return; }

        const journalPath = await ensureValidPath();
        if (!journalPath) { return; }

        const templateFolder = path.join(journalPath, '.templates');
        if (!fs.existsSync(templateFolder)) {
            await fs.promises.mkdir(templateFolder, { recursive: true });
        }

        const targetFilename = path.basename(uri.fsPath);
        const templateName = await vscode.window.showInputBox({
            prompt: `Save '${targetFilename}' as template name (e.g., meeting-notes)`,
            value: path.basename(uri.fsPath, '.md')
        });
        if (!templateName) { return; }

        const contentArray = await vscode.workspace.fs.readFile(uri);
        let contentToSave = new TextDecoder().decode(contentArray);

        const firstLineMatch = contentToSave.match(/^([^\r\n]*)(\r?\n)?/);
        const firstLine = firstLineMatch ? firstLineMatch[1] : contentToSave;
        const newlineLen = firstLineMatch && firstLineMatch[2] ? firstLineMatch[2].length : 0;
        const fileHeaderFormat = getFileHeaderFormat();
        const regex = new RegExp(`^# ${getFormattedTimestamp(new Date(), fileHeaderFormat.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))}`);
        if (regex.test(firstLine)) {
            contentToSave = contentToSave.substring(firstLine.length + newlineLen);
        }

        await fs.promises.writeFile(path.join(templateFolder, `${templateName}.md`), contentToSave);
        vscode.window.showInformationMessage(`Template '${templateName}' saved successfully from '${targetFilename}'!`);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.goToTodaysNote', async () => {
        const journalPath = await ensureValidPath();
        if (!journalPath) { return; }

        const folderPath = path.join(journalPath, getJournalFolderPath(new Date(), getFolderStructure()));

        if (!fs.existsSync(folderPath)) {
            const selection = await vscode.window.showInformationMessage('No note found for today.', 'Create One');
            if (selection === 'Create One') { vscode.commands.executeCommand('md-journal.newDailyEntry'); }
            return;
        }

        const files = (await fs.promises.readdir(folderPath)).filter(f => f.endsWith('.md'));

        if (files.length === 0) {
            const selection = await vscode.window.showInformationMessage('No note found for today.', 'Create One');
            if (selection === 'Create One') { vscode.commands.executeCommand('md-journal.newDailyEntry'); }
        } else if (files.length === 1) {
            const document = await vscode.workspace.openTextDocument(path.join(folderPath, files[0]));
            vscode.window.showTextDocument(document);
        } else {
            const result = await vscode.window.showQuickPick(files, { placeHolder: 'Select a note to open' });
            if (result) {
                const document = await vscode.workspace.openTextDocument(path.join(folderPath, result));
                vscode.window.showTextDocument(document);
            }
        }
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.refreshEntries', async () => {
        if (!await ensureValidPath()) { return; }
        await indexService.initializeIndex();
        await updateStatusBar(statusBarItem);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.searchEntries', async () => {
        const currentJournalPath = await ensureValidPath();
        if (!currentJournalPath) { return; }

        const files = await getAllMarkdownFiles(currentJournalPath);
        if (files.length === 0) {
            vscode.window.showInformationMessage('No journal entries found.');
            return;
        }

        const items = files.map(file => ({
            label: path.basename(file, '.md'),
            description: path.relative(currentJournalPath, file),
            file: file
        }));

        const selected = await vscode.window.showQuickPick(items, { placeHolder: 'Search journal entries...' });
        if (selected) {
            const document = await vscode.workspace.openTextDocument(selected.file);
            vscode.window.showTextDocument(document);
        }
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.renameEntry', async (arg?: any) => {
        const uri = await resolveContextUri(arg);
        if (!uri) { return; }

        const oldName = path.basename(uri.fsPath, '.md');
        const targetFilename = path.basename(uri.fsPath);

        const newName = await vscode.window.showInputBox({
            prompt: `Enter new name for '${targetFilename}'`,
            value: oldName
        });
        if (!newName || newName === oldName) { return; }

        const sanitizedName = sanitizeFileName(newName);
        if (!sanitizedName) {
            vscode.window.showErrorMessage(`MD Journal: Invalid file name.`);
            return;
        }

        const newFileName = sanitizedName + '.md';
        const newUri = vscode.Uri.file(path.join(path.dirname(uri.fsPath), newFileName));

        // Skip only true no-op renames. Use case-insensitive comparison on Windows,
        // but preserve case-sensitive behavior on other platforms so case-only renames work.
        const isSamePath = os.platform() === 'win32'
            ? newUri.fsPath.toLowerCase() === uri.fsPath.toLowerCase()
            : newUri.fsPath === uri.fsPath;
        if (isSamePath) { return; }

        let overwrite = false;
        try {
            await vscode.workspace.fs.stat(newUri);
            const choice = await vscode.window.showWarningMessage(
                `A file named '${newFileName}' already exists in this folder.`,
                { modal: true },
                'Overwrite',
                'Cancel'
            );
            if (choice !== 'Overwrite') { return; }
            overwrite = true;
        } catch {
            // File does not exist, safe to rename
        }

        try {
            await vscode.workspace.fs.rename(uri, newUri, { overwrite });
            journalTreeViewProvider.refresh();
            await indexService.updateIndexForFile(uri.fsPath, false);
            await indexService.updateIndexForFile(newUri.fsPath, true);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to rename file '${targetFilename}': ${error}`);
        }
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.deleteEntry', async (arg?: any) => {
        const uri = await resolveContextUri(arg);
        if (!uri) { return; }

        const targetFilename = path.basename(uri.fsPath);
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete ${targetFilename}?`,
            { modal: true },
            'Delete'
        );

        if (confirm === 'Delete') {
            try {
                await vscode.workspace.fs.delete(uri);
                journalTreeViewProvider.refresh();
                await indexService.updateIndexForFile(uri.fsPath, true);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete file '${targetFilename}': ${error}`);
            }
        }
    }));

    return disposables;
}