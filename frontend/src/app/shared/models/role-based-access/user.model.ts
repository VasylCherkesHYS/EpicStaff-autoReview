export enum UserOrganizationRole {
    SUPER_ADMIN = 'super_admin',
    ADMIN = 'admin',
    FLOW_DESIGNER = 'flow_designer',
    RAG_ENGINEER = 'rag_engineer',
}

export interface GetUserResponse {
    id: number;
    name: string;
    role: UserOrganizationRole;
    initials: string;
    organizations: UserOrganization[];
}

export interface UserOrganization {
    id: number;
    name: string;
    initial: string;
    active: boolean;
}

export interface GetUsersResponse {
    id: number;
    name: string;
    email: string;
    roles: UserOrganizationRole[];
    initials: string;
}
