import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getAllMarkdownFiles } from './utilities';

interface LinkIndex {
    [filePath: string]: {
        linksTo: string[];
        linkedFrom: string[];
    };
}

export class LinkIndexManager {
    private linkIndex: LinkIndex = {};
    private context: vscode.ExtensionContext;
    private journalPath: string;

    constructor(context: vscode.ExtensionContext, journalPath: string) {
        this.context = context;
        this.journalPath = journalPath;
        this.loadIndex();
    }

    public setJournalPath(newPath: string) {
        this.journalPath = newPath;
        this.initializeIndex();
    }

    private loadIndex() {
        const storedIndex = this.context.globalState.get<LinkIndex>('mdJournalLinkIndex', {});
        this.linkIndex = storedIndex;
    }

    private saveIndex() {
        this.context.globalState.update('mdJournalLinkIndex', this.linkIndex);
    }

    public async updateIndexForFile(filePath: string, save: boolean = true) {
        
        this.removeFileFromIndex(filePath);

        if (!fs.existsSync(filePath)) {
            if (save) {
                this.saveIndex();
            }
            return;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const links = this.extractWikilinks(content);

        this.linkIndex[filePath] = { linksTo: [], linkedFrom: [] };
        for (const linkTitle of links) {
            const targetPath = await this.resolveLinkPath(filePath, linkTitle);
            if (targetPath) {
                this.linkIndex[filePath].linksTo.push(targetPath);
                if (!this.linkIndex[targetPath]) {
                    this.linkIndex[targetPath] = { linksTo: [], linkedFrom: [] };
                }
                if (!this.linkIndex[targetPath].linkedFrom.includes(filePath)) {
                    this.linkIndex[targetPath].linkedFrom.push(filePath);
                }
            }
        }
        if (save) {
            this.saveIndex();
        }
    }

    private removeFileFromIndex(filePath: string) {
        delete this.linkIndex[filePath];

        for (const file in this.linkIndex) {
            this.linkIndex[file].linkedFrom = this.linkIndex[file].linkedFrom.filter(p => p !== filePath);
            this.linkIndex[file].linksTo = this.linkIndex[file].linksTo.filter(p => p !== filePath);
        }
    }

    private extractWikilinks(content: string): string[] {
        const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
        const matches = [...content.matchAll(wikilinkRegex)];
        return matches.map(match => match[1]);
    }

    private async resolveLinkPath(sourceFilePath: string, linkTitle: string): Promise<string | undefined> {
        const journalRoot = this.journalPath;
        if (!journalRoot) {
            return undefined;
        }

        const possiblePath = path.join(journalRoot, `${linkTitle}.md`);
        if (fs.existsSync(possiblePath)) {
            return possiblePath;
        }

        const allMdFiles = await getAllMarkdownFiles(journalRoot);
        const foundFile = allMdFiles.find(file => {
            const basename = path.basename(file, '.md').replace(/-/g, ' ');
            const match = basename === linkTitle.replace(/-/g, ' ');
            return match;
        });

        if (foundFile) {
            return foundFile;
        }

        return possiblePath;
    }

    public getBacklinks(filePath: string): string[] {
        return this.linkIndex[filePath]?.linkedFrom || [];
    }

    public async initializeIndex() {
        this.linkIndex = {};
        const files = await getAllMarkdownFiles(this.journalPath);
        for (const file of files) {
            await this.updateIndexForFile(file, false);
        }
        this.saveIndex();
    }
}