export interface GetOrganizationsResponse {
    id: number;
    name: string;
    initial: string;
    active: boolean;
    users: number;
    projects: number;
    agents: number;
    tools: number;
    flows: number;
    knowledges: number;
}
