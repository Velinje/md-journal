import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';

/** Returns the explicitly configured journal path, or empty string if not set.
 *  Does NOT fall back to a default — callers that need a guaranteed path should
 *  use ensureValidPath() (in commands.ts) which will prompt the user. */
export function getJournalPath(): string {
    const config = vscode.workspace.getConfiguration('md-journal');
    const inspected = config.inspect<string>('journalPath');
    const configuredPath =
        inspected?.workspaceFolderValue ??
        inspected?.workspaceValue ??
        inspected?.globalValue ??
        '';

    if (!configuredPath.trim()) {
        return '';
    }
    // Expand leading ~ to home dir
    const expanded = (configuredPath.startsWith('~/') || configuredPath.startsWith('~\\') || configuredPath === '~')
        ? configuredPath.replace(/^~(?=$|\/|\\)/, os.homedir())
        : configuredPath;
    return path.normalize(expanded);
}

/** Returns true only if the user has explicitly set a journalPath in settings. */
export function isJournalPathConfigured(): boolean {
    return getJournalPath() !== '';
}

export function getFolderStructure(): string {
    return vscode.workspace.getConfiguration('md-journal').get<string>('folderStructure', 'YYYY/MMMM/DD-dddd');
}

export function getFileHeaderFormat(): string {
    return vscode.workspace.getConfiguration('md-journal').get<string>('fileHeaderFormat', 'YYYY-MM-DD HH:mm:ss');
}

export async function verifyJournalPath(journalPath: string | undefined): Promise<boolean> {
    if (!journalPath) {
        return false;
    }
    try {
        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(journalPath));
        return (stat.type & vscode.FileType.Directory) !== 0;
    } catch {
        return false;
    }
}
