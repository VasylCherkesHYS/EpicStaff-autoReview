export interface GraphSessionGraph {
    id: number;
    name: string;
    metadata: any;
}

export enum GraphSessionStatus {
    RUNNING = 'run',
    ERROR = 'error',
    ENDED = 'end',
    WAITING_FOR_USER = 'wait_for_user',
    PENDING = 'pending',
    EXPIRED = 'expired',
    STOP = 'stop',
}

export interface GraphSession {
    id: number;
    graph: GraphSessionGraph;
    status: GraphSessionStatus;
    status_data: Record<string, any>;
    initial_state: Record<string, any>;
    created_at: string;
    finished_at: string | null;
}

export interface SessionUpdates {
    status: GraphSessionStatus;
}

export interface GraphSessionLight {
    id: number;
    graph_id: number;
    status: GraphSessionStatus;
    status_updated_at: string;
    created_at: string;
    finished_at: string | null;
}

export type SessionStatusesCounts = {
    run: number;
    wait_for_user: number;
    error: number;
    pending: number;
    stop: number;
};

export type GraphSessionStatusesCounts = {
    [graph_id: string]: SessionStatusesCounts;
};

export type SessionStatusesCountsMap = Map<string, SessionStatusesCounts>;

export const defaultSessionStatusesCounts = (): SessionStatusesCounts => ({
    run: 0,
    wait_for_user: 0,
    error: 0,
    pending: 0,
    stop: 0,
});

export interface RunGraphResponse {
    session_id: number;
}

