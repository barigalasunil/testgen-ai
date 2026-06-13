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

function splitLongText(input: string, maxChars: number): string[] {
    const sentences = input.match(/[^.!?\n]+[.!?]*/g) || [input];
    const chunks: string[] = [];
    let current = "";

    for (const sentence of sentences) {
        const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
        if (next.length > maxChars && current.trim()) {
            chunks.push(current.trim());
            current = sentence.trim();
        } else {
            current = next;
        }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks.flatMap(chunk => {
        if (chunk.length <= maxChars) return [chunk];
        const parts: string[] = [];
        for (let start = 0; start < chunk.length; start += maxChars) {
            parts.push(chunk.slice(start, start + maxChars).trim());
        }
        return parts;
    });
}

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
            chunks.push(...splitLongText(paragraph, maxChars));
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
