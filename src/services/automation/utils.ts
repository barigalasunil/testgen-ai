import { join } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

export const PROJECT_BASE_URL = process.env.SAUCEDEMO_BASE_URL || 'https://www.saucedemo.com';

export function getProjectRoot(): string {
    let root = process.cwd();
    if (root.includes('.next') || root.includes('dist')) {
        root = root.split('.next')[0].split('dist')[0];
    }
    return root;
}

export function sanitizeFilePart(value: string) {
    return value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'artifact';
}

export function collectArtifactFiles(dir: string, suffixes: string[]) {
    const found: string[] = [];
    if (!existsSync(dir)) return found;
    const walk = (current: string) => {
        for (const item of readdirSync(current)) {
            const full = join(current, item);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (suffixes.some(suffix => item.endsWith(suffix))) {
                found.push(full);
            }
        }
    };
    walk(dir);
    return found;
}