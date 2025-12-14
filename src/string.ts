export function sanitizeFileName(name: string): string {
    const sanitized = name.replace(/^[#\s]+/, '').replace(/[<>:"/\\|?*]/g, '');
    return sanitized.replace(/\s/g, '-').toLowerCase();
}
