import { UserRole } from '@shared/models';

export const ROLE_LABELS: Record<UserRole, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Admin',
    [UserRole.ADMIN]: 'Admin',
    [UserRole.FLOW_DESIGNER]: 'Flow Designer',
    [UserRole.RAG_ENGINEER]: 'RAG Engineer',
};
