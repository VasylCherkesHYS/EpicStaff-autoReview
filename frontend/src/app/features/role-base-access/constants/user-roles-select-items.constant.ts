import { SelectItem } from '@shared/components';
import { UserOrganizationRole } from '@shared/models';

export const USER_ROLES: SelectItem[] = [
    {
        name: 'Super Admin',
        value: UserOrganizationRole.SUPER_ADMIN,
    },
    {
        name: 'Admin',
        value: UserOrganizationRole.ADMIN,
    },
    {
        name: 'Flow Designer',
        value: UserOrganizationRole.FLOW_DESIGNER,
    },
    {
        name: 'RAG Engineer',
        value: UserOrganizationRole.RAG_ENGINEER,
    },
];
