import * as vscode from 'vscode';
import { JournalTreeViewProvider } from './JournalTreeView';
import { getFolderStructure, getJournalPath } from './settings';
import { registerCommands } from './commands';
import { TagIndexManager } from './TagIndexManager';
import { LinkIndexManager } from './LinkIndexManager';
import { BacklinksTreeViewProvider } from './BacklinksTreeView';
import { TagTreeViewProvider } from './TagTreeView';
import { registerListeners, updateStatusBar } from './listeners';

export async function activate(context: vscode.ExtensionContext) {
	const version = context.extension.packageJSON.version;
	const previousVersion = context.globalState.get<string>('mdJournal.version');
	if (previousVersion !== version) {
		context.globalState.update('mdJournal.version', version);
		if (!previousVersion) {
			vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(context.asAbsolutePath('README.md')));
		} else {
			vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.file(context.asAbsolutePath('CHANGELOG.md')));
		}
	}

	const journalPath = getJournalPath();
	if (!journalPath) {
		vscode.window.showInformationMessage('MD Journal: Journal path not set. Please set it in the settings.', 'Open Settings').then(selection => {
			if (selection === 'Open Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'md-journal.journalPath');
			}
		});
		return;
	}

	const journalTreeViewProvider = new JournalTreeViewProvider(journalPath);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-entries', journalTreeViewProvider));

	const tagIndexManager = new TagIndexManager(context, journalPath);
	await tagIndexManager.initializeIndex();

	const linkIndexManager = new LinkIndexManager(context, journalPath);
	await linkIndexManager.initializeIndex();

	const backlinksTreeViewProvider = new BacklinksTreeViewProvider(linkIndexManager);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-backlinks', backlinksTreeViewProvider));

	const tagTreeViewProvider = new TagTreeViewProvider(tagIndexManager);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-tags', tagTreeViewProvider));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (event) => {
		if (event.affectsConfiguration('md-journal.journalPath') || event.affectsConfiguration('md-journal.folderStructure')) {
			const newJournalPath = getJournalPath();
			journalTreeViewProvider.updateJournalPath(newJournalPath);
			tagIndexManager.setJournalPath(newJournalPath);
			linkIndexManager.setJournalPath(newJournalPath);
			updateStatusBar(statusBarItem, getFolderStructure(), newJournalPath);
			journalTreeViewProvider.refresh();
			tagTreeViewProvider.refresh();
		}
	}));

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBarItem);

	const folderStructure = getFolderStructure();
	updateStatusBar(statusBarItem, folderStructure, journalPath);

	const disposables = registerListeners(context, journalPath, journalTreeViewProvider, tagIndexManager, linkIndexManager, backlinksTreeViewProvider, tagTreeViewProvider, statusBarItem, folderStructure);
	disposables.forEach(disposable => context.subscriptions.push(disposable));

	registerCommands(
		context,
		journalPath,
		journalTreeViewProvider,
		tagIndexManager,
		linkIndexManager,
		backlinksTreeViewProvider,
		statusBarItem,
		async (force?: boolean) => getJournalPath(),
		folderStructure,
	);

	return {
		tagIndexManager,
		linkIndexManager
	};
}

export function deactivate() { }
