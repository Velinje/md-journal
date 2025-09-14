import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { JournalTreeViewProvider } from './JournalTreeView';
import { TagIndexManager } from './TagIndexManager';
import { TagTreeViewProvider } from './TagTreeView';
import { LinkIndexManager } from './LinkIndexManager';
import { BacklinksTreeViewProvider } from './BacklinksTreeView';

let folderStructure: string;
let tagIndexManager: TagIndexManager;
let linkIndexManager: LinkIndexManager;
let journalTreeViewProvider: JournalTreeViewProvider;
let tagTreeViewProvider: TagTreeViewProvider;
let backlinksTreeViewProvider: BacklinksTreeViewProvider;
let statusBarItem: vscode.StatusBarItem;
let disposables: vscode.Disposable[] = [];

async function initialize(context: vscode.ExtensionContext, journalPath: string) {
    // Dispose previous instances
    disposables.forEach(d => d.dispose());
    disposables = [];

    folderStructure = vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MMMM/DD-dddd');

    journalTreeViewProvider = new JournalTreeViewProvider(journalPath);
    disposables.push(vscode.window.registerTreeDataProvider('md-journal-entries', journalTreeViewProvider));

    tagIndexManager = new TagIndexManager(context, journalPath);
    await tagIndexManager.initializeIndex();

    tagTreeViewProvider = new TagTreeViewProvider(tagIndexManager);
    disposables.push(vscode.window.registerTreeDataProvider('md-journal-tags', tagTreeViewProvider));

    linkIndexManager = new LinkIndexManager(context, journalPath);
    await linkIndexManager.initializeIndex();

    backlinksTreeViewProvider = new BacklinksTreeViewProvider(linkIndexManager);
    disposables.push(vscode.window.registerTreeDataProvider('md-journal-backlinks', backlinksTreeViewProvider));

    if (!statusBarItem) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        context.subscriptions.push(statusBarItem);
    }
    updateStatusBar(statusBarItem);

    // Commands
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
            const fileHeaderFormat = vscode.workspace.getConfiguration('md-journal').get<string>('fileHeaderFormat', 'YYYY-MM-DD HH:mm:ss');
            fileContent = selectedTemplateContent.replace(/\{date\}/g, getFormattedTimestamp(today, fileHeaderFormat));
        } else {
            const fileHeaderFormat = vscode.workspace.getConfiguration('md-journal').get<string>('fileHeaderFormat', 'YYYY-MM-DD HH:mm:ss');
            fileContent = `# ${getFormattedTimestamp(today, fileHeaderFormat)}\n\n`;
        }

        fs.writeFileSync(filePath, fileContent);
        journalTreeViewProvider.refresh();

        const document = await vscode.workspace.openTextDocument(filePath);
        vscode.window.showTextDocument(document);
        updateStatusBar(statusBarItem);
        tagIndexManager.updateIndexForFile(filePath);
        tagTreeViewProvider.refresh();
        linkIndexManager.updateIndexForFile(filePath);
        backlinksTreeViewProvider.refresh(filePath);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.saveAsTemplate', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage('No active editor found.');
            return;
        }

        const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
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
        const fileHeaderFormat = vscode.workspace.getConfiguration('md-journal').get<string>('fileHeaderFormat', 'YYYY-MM-DD HH:mm:ss');
        const regex = new RegExp(`^# ${getFormattedTimestamp(new Date(), fileHeaderFormat.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&'))}`);

        if (regex.test(firstLine)) {
            contentToSave = editor.document.getText().substring(editor.document.lineAt(0).rangeIncludingLineBreak.end.character);
        }

        const templateFilePath = path.join(templateFolder, `${templateName}.md`);
        fs.writeFileSync(templateFilePath, contentToSave);
        vscode.window.showInformationMessage(`Template '${templateName}' saved successfully!`);
    }));

    disposables.push(vscode.commands.registerCommand('md-journal.goToTodaysNote', async () => {
        const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');

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
        updateStatusBar(statusBarItem);
    }));

    // Listeners
    disposables.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
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

    disposables.push(vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar(statusBarItem)));

    const watcher = vscode.workspace.createFileSystemWatcher('**/*.md');
    watcher.onDidChange(uri => { tagIndexManager.updateIndexForFile(uri.fsPath); linkIndexManager.updateIndexForFile(uri.fsPath); tagTreeViewProvider.refresh(); backlinksTreeViewProvider.refresh(); });
    watcher.onDidCreate(uri => { tagIndexManager.updateIndexForFile(uri.fsPath); linkIndexManager.updateIndexForFile(uri.fsPath); tagTreeViewProvider.refresh(); backlinksTreeViewProvider.refresh(); });
    watcher.onDidDelete(uri => { tagIndexManager.updateIndexForFile(uri.fsPath); linkIndexManager.updateIndexForFile(uri.fsPath); tagTreeViewProvider.refresh(); backlinksTreeViewProvider.refresh(); });
    disposables.push(watcher);

    disposables.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
        if (editor && editor.document.languageId === 'markdown' && editor.document.uri.fsPath.startsWith(journalPath)) {
            backlinksTreeViewProvider.refresh(editor.document.uri.fsPath);
        } else {
            backlinksTreeViewProvider.refresh();
        }
    }));

    if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'markdown' && vscode.window.activeTextEditor.document.uri.fsPath.startsWith(journalPath)) {
        backlinksTreeViewProvider.refresh(vscode.window.activeTextEditor.document.uri.fsPath);
    }

    context.subscriptions.push(...disposables);
}

export async function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async event => {
        if (event.affectsConfiguration('md-journal.journalPath')) {
            const newJournalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
            await initialize(context, newJournalPath);
        }
        if (event.affectsConfiguration('md-journal.folderStructure')) {
            folderStructure = vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MMMM/DD-dddd');
            if (journalTreeViewProvider) {
                journalTreeViewProvider.refresh();
            }
        }
    }));

    let journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath');
    if (!journalPath) {
        journalPath = await getJournalPath(true);
        if (!journalPath) {
            return;
        }
    }

    await initialize(context, journalPath);
}

async function getJournalPath(force: boolean = false): Promise<string | undefined> {
    let journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath');

    if (!journalPath || force) {
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

function updateStatusBar(statusBarItem: vscode.StatusBarItem) {
    const journalPath = vscode.workspace.getConfiguration('md-journal').get<string>('journalPath', '');
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

function getFormattedTimestamp(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);

    return format
        .replace('YYYY', year.toString())
        .replace('MM', month)
        .replace('DD', day)
        .replace('dddd', dayOfWeek)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

function getJournalFolderPath(date: Date, folderStructure: string): string {
    const year = date.getFullYear().toString();
    const monthNumber = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date);
    const dayNumber = date.getDate().toString().padStart(2, '0');
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(date);

    let folderPath = folderStructure
        .replace('YYYY', year)
        .replace('MMMM', monthName)
        .replace('MM', monthNumber)
        .replace('dddd', dayName)
        .replace('DD', dayNumber);

    folderPath = folderPath.replace(/>/g, path.sep);

    return folderPath;
}

function sanitizeFileName(name: string): string {
    const sanitized = name.replace(/^[#\s]+/, '').replace(/[<>:"/\\|?*]/g, '');
    return sanitized.replace(/\s/g, '-').toLowerCase();
}

export function deactivate() {
    disposables.forEach(d => d.dispose());
}