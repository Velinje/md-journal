import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class FolderTreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly fullPath: string,
        public readonly level: number
    ) {
        super(label, collapsibleState);
        this.contextValue = 'folder';
    }
}

export class JournalTreeViewProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private journalPath: string | undefined) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!this.journalPath) {
            const messageItem = new vscode.TreeItem('Journal path not set.', vscode.TreeItemCollapsibleState.None);
            messageItem.command = {
                command: 'md-journal.newDailyEntry',
                title: 'Set Journal Path'
            };
            return Promise.resolve([messageItem]);
        }

        const folderStructure = vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MMMM/DD-dddd');
        const components = folderStructure.split(/[\/>]/);

        if (element) {
            if (element.contextValue === 'folder') {
                const currentPath = (element as FolderTreeItem).fullPath;
                const currentLevel = (element as FolderTreeItem).level;

                const children = fs.readdirSync(currentPath).filter(file => {
                    const fullPath = path.join(currentPath, file);
                    const isDirectory = fs.statSync(fullPath).isDirectory();
                    const isMarkdownFile = file.endsWith('.md');

                    if (isDirectory) {
                        if (file === '.templates') {
                            return false;
                        }
                        const nextLevelComponent = components[currentLevel];
                        return this.matchesComponentPattern(file, nextLevelComponent);
                    }
                    return isMarkdownFile;
                }).sort((a, b) => {
                    const aPath = path.join(currentPath, a);
                    const bPath = path.join(currentPath, b);
                    const aIsDir = fs.statSync(aPath).isDirectory();
                    const bIsDir = fs.statSync(bPath).isDirectory();
                
                    if (aIsDir && bIsDir) {
                        const aDate = this.getDateFromPath(aPath, folderStructure);
                        const bDate = this.getDateFromPath(bPath, folderStructure);
                        if (aDate && bDate) {
                            return bDate.getTime() - aDate.getTime();
                        }
                    }
                    return b.localeCompare(a);
                });

                return Promise.resolve(
                    children.map(child => {
                        const childPath = path.join(currentPath, child);
                        if (fs.statSync(childPath).isDirectory()) {
                            return new FolderTreeItem(child, vscode.TreeItemCollapsibleState.Collapsed, childPath, currentLevel + 1);
                        }
                        else {
                            const treeItem = new vscode.TreeItem(child, vscode.TreeItemCollapsibleState.None);
                            treeItem.command = {
                                command: 'vscode.open',
                                title: 'Open File',
                                arguments: [vscode.Uri.file(childPath)]
                            };
                            return treeItem;
                        }
                    })
                );
            }
            return Promise.resolve([]);
        }
        else {
            const rootPath = this.journalPath;
            const firstLevelComponent = components[0];

            const firstLevelFolders = fs.readdirSync(rootPath).filter(file => {
                if (file === '.templates') {
                    return false;
                }
                const fullPath = path.join(rootPath, file);
                return fs.statSync(fullPath).isDirectory() && this.matchesComponentPattern(file, firstLevelComponent);
            }).sort((a, b) => {
                const aDate = this.getDateFromPath(path.join(rootPath, a), folderStructure);
                const bDate = this.getDateFromPath(path.join(rootPath, b), folderStructure);
                if (aDate && bDate) {
                    return bDate.getTime() - aDate.getTime();
                }
                return b.localeCompare(a);
            });

            return Promise.resolve(
                firstLevelFolders.map(folder => new FolderTreeItem(folder, vscode.TreeItemCollapsibleState.Collapsed, path.join(rootPath, folder), 1))
            );
        }
    }

    updateJournalPath(journalPath: string): void {
        this.journalPath = journalPath;
        this.refresh();
    }

    private matchesComponentPattern(name: string, component: string): boolean {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
        let regexString = component
            .replace('YYYY', '\\d{4}')
            .replace('MMMM', `(${monthNames.join('|')})`)
            .replace('MM', '\\d{2}')
            .replace('dddd', `(${dayNames.join('|')})`)
            .replace('DD', '\\d{2}');
    
        regexString = `^${regexString}$`;
    
        const regex = new RegExp(regexString);
        return regex.test(name);
    }

    private getDateFromPath(folderPath: string, folderStructure: string): Date | null {
        const journalPath = this.journalPath;
        if (!journalPath) {
            return null;
        }
    
        const relativePath = path.relative(journalPath, folderPath);
        const pathParts = relativePath.split(path.sep);
        const structureParts = folderStructure.split(/[\/>]/);
    
        let year, month, day;
    
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
        for (let i = 0; i < structureParts.length; i++) {
            const sPart = structureParts[i];
            const pPart = pathParts[i];
            if (!pPart) {
                continue;
            }
    
            const yyyy = sPart.includes('YYYY');
            const mmmm = sPart.includes('MMMM');
            const mm = sPart.includes('MM');
            const dd = sPart.includes('DD');
    
            const regexStr = '^' + sPart
                .replace('YYYY', '(\\d{4})')
                .replace('MMMM', `(${monthNames.join('|')})`)
                .replace('MM', '(\\d{2})')
                .replace('dddd', '[a-zA-Z]+')
                .replace('DD', '(\\d{2})') + '$';
            
            const matches = pPart.match(new RegExp(regexStr));
            if (!matches) {
                continue;
            }
    
            let matchIndex = 1;
            if (yyyy) {
                year = parseInt(matches[matchIndex++]);
            }
            if (mmmm) {
                month = monthNames.indexOf(matches[matchIndex++]);
            } else if (mm) {
                month = parseInt(matches[matchIndex++]) - 1;
            }
            if (dd) {
                day = parseInt(matches[matchIndex++]);
            }
        }
    
        if (year !== undefined) {
            return new Date(year, month !== undefined ? month : 0, day !== undefined ? day : 1);
        }
    
        return null;
    }
}
