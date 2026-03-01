import * as vscode from 'vscode';
import { IndexService } from './services/IndexService';
import * as path from 'path';

export class BacklinkTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly resourceUri: vscode.Uri,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = this.resourceUri.fsPath;
    }
}

export class BacklinksTreeViewProvider implements vscode.TreeDataProvider<BacklinkTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<BacklinkTreeItem | undefined | void> = new vscode.EventEmitter<BacklinkTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<BacklinkTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private indexService: IndexService;
    private currentFileBacklinks: string[] = [];

    constructor(indexService: IndexService) {
        this.indexService = indexService;

        const handleEditorChange = () => {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'markdown') {
                this.refresh(editor.document.uri.fsPath);
            } else {
                this.refresh();
            }
        };

        this.indexService.onIndexUpdated(handleEditorChange);
        vscode.window.onDidChangeActiveTextEditor(handleEditorChange);
    }

    refresh(filePath?: string): void {
        if (filePath) {
            this.currentFileBacklinks = this.indexService.getBacklinks(filePath);
        } else {
            this.currentFileBacklinks = [];
        }
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: BacklinkTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: BacklinkTreeItem): Thenable<BacklinkTreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            if (this.currentFileBacklinks.length === 0) {
                return Promise.resolve([new BacklinkTreeItem('No backlinks found.', vscode.Uri.parse('empty:'), vscode.TreeItemCollapsibleState.None)]);
            }
            return Promise.resolve(
                this.currentFileBacklinks.map(linkPath => new BacklinkTreeItem(path.basename(linkPath), vscode.Uri.file(linkPath), vscode.TreeItemCollapsibleState.None, {
                    command: 'vscode.open',
                    title: 'Open File',
                    arguments: [vscode.Uri.file(linkPath)]
                }))
            );
        }
    }
}
