export type RequirementChunk = {
    index: number;
    total: number;
    text: string;
};

export type ChunkedRequirement = {
    originalLength: number;
    chunkingApplied: boolean;
    chunks: RequirementChunk[];
    prompt: string;
};

const DEFAULT_MAX_CHARS = 3500;

function splitByParagraphs(input: string, maxChars: number): string[] {
    const paragraphs = input
        .split(/\n\s*\n/)
        .map(part => part.trim())
        .filter(Boolean);

    if (paragraphs.length === 0) return [];

    const chunks: string[] = [];
    let current = '';

    for (const paragraph of paragraphs) {
        if (paragraph.length > maxChars) {
            if (current.trim()) {
                chunks.push(current.trim());
                current = '';
            }
            for (let start = 0; start < paragraph.length; start += maxChars) {
                chunks.push(paragraph.slice(start, start + maxChars).trim());
            }
            continue;
        }

        const next = current ? `${current}\n\n${paragraph}` : paragraph;
        if (next.length > maxChars && current.trim()) {
            chunks.push(current.trim());
            current = paragraph;
        } else {
            current = next;
        }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

export function chunkRequirement(input: string, maxChars = DEFAULT_MAX_CHARS): ChunkedRequirement {
    const normalized = input.trim();
    if (normalized.length <= maxChars) {
        return {
            originalLength: normalized.length,
            chunkingApplied: false,
            chunks: [{ index: 1, total: 1, text: normalized }],
            prompt: normalized,
        };
    }

    const rawChunks = splitByParagraphs(normalized, maxChars);
    const chunks = rawChunks.map((text, index) => ({
        index: index + 1,
        total: rawChunks.length,
        text,
    }));

    return {
        originalLength: normalized.length,
        chunkingApplied: true,
        chunks,
        prompt: [
            'Requirement Analysis:',
            'Analyze the complete requirement across all chunks before generating test cases.',
            '',
            'Chunking:',
            ...chunks.map(chunk => `Chunk ${chunk.index}/${chunk.total}:\n${chunk.text}`),
            '',
            'Coverage Planning:',
            'Plan coverage across happy path, negative, edge, boundary, security, resilience, and persona scenarios without duplicating cases between chunks.',
            '',
            'Test Case Generation:',
            'Generate one consolidated test case set for the complete requirement.',
        ].join('\n\n'),
    };
}
