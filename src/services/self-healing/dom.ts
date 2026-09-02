import { join, relative } from 'path';
import { writeFileSync } from 'fs';
import { PROJECT_BASE_URL, getProjectRoot } from '../automation/utils';
import type { RunArtifacts } from '../automation/types';
import type { DomCandidates } from './types';

export function emptyDomCandidates(url?: string): DomCandidates {
    return {
        url,
        buttons: [],
        inputs: [],
        labels: [],
        placeholders: [],
        links: [],
        headings: [],
        ariaLabels: [],
        testIds: [],
        textCandidates: [],
    };
}

export async function collectDomCandidates(url: string | undefined, artifacts: RunArtifacts): Promise<{ candidates: DomCandidates; path: string; count: number }> {
    const domPath = join(artifacts.healingDir, 'dom-candidates.json');
    let candidates = emptyDomCandidates(url);
    try {
        const { chromium } = await import('playwright');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url || PROJECT_BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
        candidates = await page.evaluate(() => {
            const text = (value: string | null | undefined) => String(value || '').replace(/\s+/g, ' ').trim();
            const unique = (items: string[]) => Array.from(new Set(items.map(text).filter(Boolean))).slice(0, 50);
            const attr = (selector: string, name: string) => unique(Array.from(document.querySelectorAll(selector)).map(el => el.getAttribute(name) || ''));
            return {
                url: location.href,
                buttons: unique(Array.from(document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')).map(el => text(el.textContent) || (el as HTMLInputElement).value || el.getAttribute('aria-label') || '')),
                inputs: unique(Array.from(document.querySelectorAll('input, textarea, select')).map(el => [el.getAttribute('name'), el.getAttribute('id'), el.getAttribute('type')].filter(Boolean).join(':'))),
                labels: unique(Array.from(document.querySelectorAll('label')).map(el => text(el.textContent))),
                placeholders: attr('input[placeholder], textarea[placeholder]', 'placeholder'),
                links: unique(Array.from(document.querySelectorAll('a')).map(el => text(el.textContent) || el.getAttribute('href') || '')),
                headings: unique(Array.from(document.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(el => text(el.textContent))),
                ariaLabels: attr('[aria-label]', 'aria-label'),
                testIds: unique([
                    ...attr('[data-testid]', 'data-testid'),
                    ...attr('[data-test]', 'data-test'),
                    ...attr('[data-qa]', 'data-qa'),
                ]),
                textCandidates: unique(Array.from(document.querySelectorAll('button,a,label,h1,h2,h3,[role="button"],[role="link"]')).map(el => text(el.textContent))),
            };
        });
        await browser.close();
    } catch {
        candidates = emptyDomCandidates(url);
    }
    const count = Object.entries(candidates)
        .filter(([key]) => key !== 'url')
        .reduce((total, [, value]) => total + (Array.isArray(value) ? value.length : 0), 0);
    writeFileSync(domPath, JSON.stringify(candidates, null, 2), 'utf-8');
    return { candidates, path: relative(getProjectRoot(), domPath), count };
}