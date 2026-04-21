export enum UserRole {
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
    organizations?: {
        id: number;
        roles: UserRole[]; // roles of user in the organization
    };
}

export interface GetUserResponse {
    id: number;
    name: string;
    email: string;
    organizations: UserOrgData[];
}

export interface UserOrgData {
    id: number;
    name: string;
    active: boolean;
    roles: UserRole[];
}
