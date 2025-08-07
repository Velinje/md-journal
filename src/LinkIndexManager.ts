import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface LinkIndex {
    [filePath: string]: {
        linksTo: string[]; // Files this file links to
        linkedFrom: string[]; // Files that link to this file
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

    public async updateIndexForFile(filePath: string) {
        // Clean up old entries for this file
        this.removeFileFromIndex(filePath);

        if (!fs.existsSync(filePath)) {
            this.saveIndex();
            return; // File deleted
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const links = this.extractWikilinks(content);

        // Add new links from this file
        this.linkIndex[filePath] = { linksTo: [], linkedFrom: [] };
        links.forEach(linkTitle => {
            const targetPath = this.resolveLinkPath(filePath, linkTitle);
            if (targetPath) {
                this.linkIndex[filePath].linksTo.push(targetPath);
                if (!this.linkIndex[targetPath]) {
                    this.linkIndex[targetPath] = { linksTo: [], linkedFrom: [] };
                }
                if (!this.linkIndex[targetPath].linkedFrom.includes(filePath)) {
                    this.linkIndex[targetPath].linkedFrom.push(filePath);
                }
            }
        });
        this.saveIndex();
    }

    private removeFileFromIndex(filePath: string) {
        // Remove file from its own entry
        delete this.linkIndex[filePath];

        // Remove file from linkedFrom lists of other files
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

    private resolveLinkPath(sourceFilePath: string, linkTitle: string): string | undefined {
        // Simple resolution: assume linkTitle is a file name within the journal
        // This needs to be more robust for real-world wikilinks (e.g., handling subfolders)
        // For now, we'll just search for a file with that name in the journal path
        const journalRoot = this.journalPath;
        if (!journalRoot) {
            return undefined;
        }

        // Basic attempt: check if it's a direct file in the journal root or a subfolder
        const possiblePath = path.join(journalRoot, `${linkTitle}.md`);
        if (fs.existsSync(possiblePath)) {
            return possiblePath;
        }

        // More advanced: search all markdown files in the journal for a matching basename
        // This can be slow for large journals, consider optimizing later
        const allMdFiles = this.getAllMarkdownFilesSync(journalRoot);
        const foundFile = allMdFiles.find(file => path.basename(file, '.md') === linkTitle);
        return foundFile;
    }

    private getAllMarkdownFilesSync(dir: string): string[] {
        let markdownFiles: string[] = [];
        if (!fs.existsSync(dir)) {
            return markdownFiles;
        }
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                markdownFiles = markdownFiles.concat(this.getAllMarkdownFilesSync(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                markdownFiles.push(fullPath);
            }
        }
        return markdownFiles;
    }

    public getBacklinks(filePath: string): string[] {
        return this.linkIndex[filePath]?.linkedFrom || [];
    }

    public async initializeIndex() {
        this.linkIndex = {}; // Clear existing index
        const files = await this.getAllMarkdownFilesAsync(this.journalPath);
        for (const file of files) {
            await this.updateIndexForFile(file);
        }
        this.saveIndex();
    }

    private async getAllMarkdownFilesAsync(dir: string): Promise<string[]> {
        let markdownFiles: string[] = [];
        if (!fs.existsSync(dir)) {
            return markdownFiles;
        }
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                markdownFiles = markdownFiles.concat(await this.getAllMarkdownFilesAsync(fullPath));
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                markdownFiles.push(fullPath);
            }
        }
        return markdownFiles;
    }
}