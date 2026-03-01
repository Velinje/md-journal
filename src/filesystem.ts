import * as fs from 'fs';
import * as path from 'path';

export async function getAllMarkdownFiles(dir: string): Promise<string[]> {
    let markdownFiles: string[] = [];
    if (!fs.existsSync(dir)) {
        return markdownFiles;
    }
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== '.templates') {
                markdownFiles = markdownFiles.concat(await getAllMarkdownFiles(fullPath));
            }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            markdownFiles.push(fullPath);
        }
    }
    return markdownFiles;
}

export function getAllMarkdownFilesSync(dir: string): string[] {
    let markdownFiles: string[] = [];
    if (!fs.existsSync(dir)) {
        return markdownFiles;
    }
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== '.templates') {
                markdownFiles = markdownFiles.concat(getAllMarkdownFilesSync(fullPath));
            }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            markdownFiles.push(fullPath);
        }
    }
    return markdownFiles;
}
