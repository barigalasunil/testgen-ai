export type TestCase = {
    id: string;
    title: string;
    description?: string;
    steps: string;
    expectedResult: string;
    priority?: string;
};

export type HistoryItem = {
    id: string;
    title?: string;
    prompt: string;
    result: { testCases: TestCase[] } | null;
    error: string | null;
    timestamp: number;
};
