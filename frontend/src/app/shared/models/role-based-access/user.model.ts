export enum UserRole {
    SUPER_ADMIN = 'super_admin',
    ADMIN = 'admin',
}

export interface GetUserResponse {
    id: number;
    name: string;
    role: UserRole;
    initials: string;
}
