import { UserRole } from '../index';

export interface CreateOrganizationRequest {
    name: string;
    users: CreateOrgUser[];
}

interface CreateOrgUser {
    id: number;
    roles: UserRole[];
}

export interface GetOrganizationsResponse {
    id: number;
    name: string;
    active: boolean;
    users: number;
    projects: number;
    agents: number;
    tools: number;
    flows: number;
    knowledges: number;
}

export interface GetOrganizationDetailsResponse {}
