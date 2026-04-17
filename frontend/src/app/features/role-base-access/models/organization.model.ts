import { UserOrganizationRole } from '@shared/models';

export interface CreateOrganizationRequest {
    name: string;
    users: CreateOrgUser[];
}

interface CreateOrgUser {
    id: number;
    roles: UserOrganizationRole[];
}

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

export interface GetOrganizationDetailsResponse {}
