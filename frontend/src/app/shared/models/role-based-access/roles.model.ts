import { Permission } from './permissions.enum';

export interface CreateRoleRequest {
    name: string;
    description: string | null;
    permissions: Permission[];
}

export interface GetRoleResponse {
    id: number;
    name: string;
    description: string | null;
    permissions: Permission[];
    member_count: number;
    updated_at: string;
    is_built_in: boolean;
}

export interface UpdateRoleRequest {
    name: string;
    description: string | null;
    permissions: Permission[];
}
