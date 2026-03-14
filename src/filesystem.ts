import * as vscode from 'vscode';
import * as path from 'path';

export async function getAllMarkdownFiles(dir: string, markdownFiles: string[] = []): Promise<string[]> {
    try {
        const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
        for (const [name, type] of entries) {
            const fullPath = path.join(dir, name);
            if (type === vscode.FileType.Directory || type === (vscode.FileType.Directory | vscode.FileType.SymbolicLink)) {
                if (name !== '.templates' && name !== '.' && name !== '..') {
                    if ((type & vscode.FileType.SymbolicLink) === 0) {
                        await new Promise(resolve => setTimeout(resolve, 0));
                        await getAllMarkdownFiles(fullPath, markdownFiles);
                    }
                }
            } else if (type === vscode.FileType.File || type === (vscode.FileType.File | vscode.FileType.SymbolicLink)) {
                if (name.endsWith('.md')) {
                    markdownFiles.push(fullPath);
                }
            }
        }
    } catch (error) {
        console.error(`Failed to read directory ${dir}:`, error);
    }
    return markdownFiles;
}
