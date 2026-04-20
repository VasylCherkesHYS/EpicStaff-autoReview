export enum UserOrganizationRole {
    SUPER_ADMIN = 'super_admin',
    ADMIN = 'admin',
    FLOW_DESIGNER = 'flow_designer',
    RAG_ENGINEER = 'rag_engineer',
}

export interface CreateUserRequest {
    name: string;
    email: string;
    password: string;
    superadmin: boolean;
    organization: {
        id: number;
        roles: UserOrganizationRole[];
    };
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
    active: boolean;
}

export interface GetUsersResponse {
    id: number;
    name: string;
    email: string;
    roles: UserOrganizationRole[];
}
