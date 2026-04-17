export interface GetWorkspaceInfoResponse {
    organizations: WorkspaceInfoItem;
    users: WorkspaceInfoItem;
    roles: WorkspaceInfoItem;
    flows: WorkspaceInfoItem;
}

export interface WorkspaceInfoItem {
    value: number;
    delta: number;
    trend: 'increase' | 'decrease';
}
