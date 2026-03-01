import * as vscode from 'vscode';
import { JournalTreeViewProvider } from './JournalTreeView';
import { getFolderStructure, getJournalPath } from './settings';
import { registerCommands } from './commands';
import { IndexService } from './services/IndexService';
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

	const indexService = new IndexService(journalPath);
	await indexService.initializeIndex();

	const journalTreeViewProvider = new JournalTreeViewProvider(journalPath, indexService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-entries', journalTreeViewProvider));

	const backlinksTreeViewProvider = new BacklinksTreeViewProvider(indexService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-backlinks', backlinksTreeViewProvider));

	const tagTreeViewProvider = new TagTreeViewProvider(indexService);
	context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-tags', tagTreeViewProvider));

	context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (event) => {
		if (event.affectsConfiguration('md-journal.journalPath') || event.affectsConfiguration('md-journal.folderStructure')) {
			const newJournalPath = getJournalPath();
			journalTreeViewProvider.updateJournalPath(newJournalPath);
			indexService.setJournalPath(newJournalPath);
			await updateStatusBar(statusBarItem, getFolderStructure(), newJournalPath);
			journalTreeViewProvider.refresh();
			tagTreeViewProvider.refresh();
		}
	}));

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	context.subscriptions.push(statusBarItem);

	const folderStructure = getFolderStructure();
	await updateStatusBar(statusBarItem, folderStructure, journalPath);

	const disposables = registerListeners(context, journalPath, indexService, statusBarItem, folderStructure);
	disposables.forEach(disposable => context.subscriptions.push(disposable));

	registerCommands(
		context,
		journalPath,
		journalTreeViewProvider,
		indexService,
		backlinksTreeViewProvider,
		statusBarItem,
		async (force?: boolean) => getJournalPath(),
		folderStructure,
	);

	return {
		indexService
	};
}

export function deactivate() { }
