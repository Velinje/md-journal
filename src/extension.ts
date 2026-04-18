import * as vscode from 'vscode';
import { JournalTreeViewProvider } from './JournalTreeView';
import { getJournalPath, isJournalPathConfigured } from './settings';
import { registerCommands } from './commands';
import { IndexService } from './services/IndexService';
import { BacklinksTreeViewProvider } from './BacklinksTreeView';
import { TagTreeViewProvider } from './TagTreeView';
import { registerListeners, updateStatusBar } from './listeners';
import { getAllMarkdownFiles } from './filesystem';
import * as path from 'path';

export async function activate(context: vscode.ExtensionContext) {
	try {
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

		let journalPath = getJournalPath();

		const setPathContext = () =>
			vscode.commands.executeCommand('setContext', 'md-journal.hasJournalPath', isJournalPathConfigured());
		await setPathContext();

		const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
		context.subscriptions.push(statusBarItem);

		const indexService = new IndexService(journalPath, context);

		const journalTreeViewProvider = new JournalTreeViewProvider(journalPath, indexService);
		context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-entries', journalTreeViewProvider));

		const backlinksTreeViewProvider = new BacklinksTreeViewProvider(indexService);
		context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-backlinks', backlinksTreeViewProvider));

		const tagTreeViewProvider = new TagTreeViewProvider(indexService);
		context.subscriptions.push(vscode.window.registerTreeDataProvider('md-journal-tags', tagTreeViewProvider));

		const disposables = registerListeners(indexService, statusBarItem);
		disposables.forEach(d => context.subscriptions.push(d));

		const commandDisposables = registerCommands(
			context,
			journalTreeViewProvider,
			indexService,
			backlinksTreeViewProvider,
			statusBarItem,
		);
		commandDisposables.forEach(d => context.subscriptions.push(d));


		context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(async (event) => {
			if (event.affectsConfiguration('md-journal.journalPath') || event.affectsConfiguration('md-journal.folderStructure')) {
				const newJournalPath = getJournalPath();
				await setPathContext();
				if (event.affectsConfiguration('md-journal.journalPath') && journalPath !== newJournalPath) {
					const oldPath = journalPath;
					journalPath = newJournalPath;

					if (oldPath && newJournalPath) {
						let files: string[] = [];
						try { files = await getAllMarkdownFiles(oldPath); } catch (e: any) { console.error(`Failed to scan old journal for migration: ${e.message ?? e}`); }

						if (files.length > 0) {
							const selection = await vscode.window.showInformationMessage(
								`MD Journal path changed. Do you want to copy your existing entries to the new folder?`,
								'Yes, Copy Files', 'No'
							);

							if (selection === 'Yes, Copy Files') {
								await vscode.window.withProgress({
									location: vscode.ProgressLocation.Notification,
									title: "Migrating MD Journal entries...",
									cancellable: false
								}, async (progress) => {
									try {
										await vscode.workspace.fs.createDirectory(vscode.Uri.file(newJournalPath));
										let copiedCount = 0;
										let skippedCount = 0;
										for (const file of files) {
											const relativePath = path.relative(oldPath, file);
											const targetUri = vscode.Uri.file(path.join(newJournalPath, relativePath));
											const targetDirUri = vscode.Uri.file(path.dirname(targetUri.fsPath));
											await vscode.workspace.fs.createDirectory(targetDirUri);

											try {
												await vscode.workspace.fs.copy(vscode.Uri.file(file), targetUri, { overwrite: false });
												copiedCount++;
											} catch (e: any) {
												const errorMessage = String(e?.message ?? e ?? '');
												const isConflict = errorMessage.includes('FileExists') || errorMessage.includes('already exists');
												if (isConflict) {
													skippedCount++;
													console.log(`Skipped existing file during migration: ${targetUri.fsPath}`);
												} else {
													throw e;
												}
											}

											progress.report({ message: `Copied ${copiedCount}, skipped ${skippedCount}, processed ${copiedCount + skippedCount} of ${files.length}` });
										}
										if (skippedCount > 0) {
											vscode.window.showInformationMessage(`Migration completed: copied ${copiedCount} journal entr${copiedCount === 1 ? 'y' : 'ies'} and skipped ${skippedCount} existing file${skippedCount === 1 ? '' : 's'}.`);
										} else {
											vscode.window.showInformationMessage(`Successfully copied ${copiedCount} journal entr${copiedCount === 1 ? 'y' : 'ies'} to the new location.`);
										}
									} catch (e) {
										vscode.window.showErrorMessage(`Failed to copy all files: ${e}`);
									}
								});
							}
						}
					}
				}

				journalTreeViewProvider.updateJournalPath(newJournalPath);
				await indexService.setJournalPath(newJournalPath);
				await updateStatusBar(statusBarItem);
				journalTreeViewProvider.refresh();
				tagTreeViewProvider.refresh();
			}
		}));

		await updateStatusBar(statusBarItem);

		const resolvedPath = getJournalPath();
		if (resolvedPath && resolvedPath !== journalPath) {
			journalPath = resolvedPath;
			await setPathContext();
			journalTreeViewProvider.updateJournalPath(resolvedPath);
			await indexService.setJournalPath(resolvedPath);
			await updateStatusBar(statusBarItem);
		} else if (journalPath) {
			indexService.initializeIndex().catch(e => {
				console.error(`Error initializing index: ${e.message ?? e}`);
			});
			journalTreeViewProvider.refresh();
			tagTreeViewProvider.refresh();
			backlinksTreeViewProvider.refresh();
		}

		return { indexService };
	} catch (e: any) {
		console.error("md-journal activation error:", e);
		vscode.window.showErrorMessage(`MD Journal failed to activate: ${e.message}`);
		return {};
	}
}

export function deactivate() { }
