import { SelectItem } from '@shared/components';
import { UserRole } from '@shared/models';

export const USER_ROLES: SelectItem[] = [
    {
        name: 'Super Admin',
        value: UserRole.SUPER_ADMIN,
    },
    {
        name: 'Admin',
        value: UserRole.ADMIN,
    },
    {
        name: 'Flow Designer',
        value: UserRole.FLOW_DESIGNER,
    },
    {
        name: 'RAG Engineer',
        value: UserRole.RAG_ENGINEER,
    },
];
