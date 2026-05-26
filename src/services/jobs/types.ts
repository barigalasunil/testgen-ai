/**
 * Base structure for background job processing.
 */
export interface Job<T = any> {
    id: string;
    type: string;
    payload: T;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    priority: number;
    createdAt: Date;
}

export abstract class BaseWorker {
    abstract process(job: Job): Promise<void>;
}
