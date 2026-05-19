import { Permission } from '@shared/models';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'export';

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export'];

export interface PermissionResourceDef {
    name: string;
    description: string;
    // undefined for an action = renders `—` (N/A)
    actions: Partial<Record<PermissionAction, Permission>>;
}

export interface PermissionGroupDef {
    name: string;
    icon: string;
    resources: PermissionResourceDef[];
}

export const ACTION_ICONS: Record<PermissionAction, string> = {
    view: 'eye',
    create: 'plus',
    edit: 'edit',
    delete: 'trash',
    export: 'download',
};

export const PERMISSION_GROUPS: PermissionGroupDef[] = [
    {
        name: 'Organizations & Access',
        icon: 'buildings',
        resources: [
            {
                name: 'Organizations',
                description: 'Create, rename, deactivate organizations',
                actions: {
                    view: Permission.ORGANIZATION_VIEW,
                    create: Permission.ORGANIZATION_CREATE,
                    edit: Permission.ORGANIZATION_EDIT,
                    delete: Permission.ORGANIZATION_DELETE,
                    // export: Permission.ORGANIZATION_EXPORT,
                },
            },
            {
                name: 'Users',
                description: 'Add/remove members, assign roles within org',
                actions: {
                    view: Permission.USERS_VIEW,
                    create: Permission.USERS_CREATE,
                    edit: Permission.USERS_EDIT,
                    delete: Permission.USERS_DELETE,
                    // export: Permission.USERS_EXPORT,
                },
            },
            {
                name: 'Invitations',
                description: 'Pending member invites',
                actions: {
                    view: Permission.INVITATIONS_VIEW,
                    create: Permission.INVITATIONS_CREATE,
                    // edit:   Permission.INVITATIONS_EDIT,
                    delete: Permission.INVITATIONS_DELETE,
                    export: Permission.INVITATIONS_EXPORT,
                },
            },
            {
                name: 'Roles',
                description: 'Create/edit custom roles and assign to users',
                actions: {
                    view: Permission.ROLES_VIEW,
                    create: Permission.ROLES_CREATE,
                    edit: Permission.ROLES_EDIT,
                    delete: Permission.ROLES_DELETE,
                    // export: Permission.ROLES_EXPORT,
                },
            },
        ],
    },
    {
        name: 'Workspace Resources',
        icon: 'workspace',
        resources: [
            {
                name: 'Projects',
                description: 'Organize AI agents and tasks',
                actions: {
                    view: Permission.PROJECTS_VIEW,
                    create: Permission.PROJECTS_CREATE,
                    edit: Permission.PROJECTS_EDIT,
                    delete: Permission.PROJECTS_DELETE,
                    // export: Permission.PROJECTS_EXPORT,
                },
            },
            {
                name: 'Staff',
                description: 'Manage AI agents and their capabilities',
                actions: {
                    view: Permission.STAFF_VIEW,
                    create: Permission.STAFF_CREATE,
                    edit: Permission.STAFF_EDIT,
                    delete: Permission.STAFF_DELETE,
                    // export: Permission.STAFF_EXPORT,
                },
            },
            {
                name: 'Tools',
                description: 'Manage built-in and custom tools',
                actions: {
                    view: Permission.TOOLS_VIEW,
                    create: Permission.TOOLS_CREATE,
                    edit: Permission.TOOLS_EDIT,
                    delete: Permission.TOOLS_DELETE,
                    // export: Permission.TOOLS_EXPORT,
                },
            },
            {
                name: 'Flows',
                description: 'Custom logic',
                actions: {
                    view: Permission.WORKSPACE_FLOWS_VIEW,
                    create: Permission.WORKSPACE_FLOWS_CREATE,
                    edit: Permission.WORKSPACE_FLOWS_EDIT,
                    delete: Permission.WORKSPACE_FLOWS_DELETE,
                    export: Permission.WORKFLOW_FLOWS_EXPORT,
                },
            },
            {
                name: 'Knowledge Sources',
                description: 'RAG collections and embeddings',
                actions: {
                    view: Permission.KNOWLEDGE_SOURCES_VIEW,
                    create: Permission.KNOWLEDGE_SOURCES_CREATE,
                    edit: Permission.KNOWLEDGE_SOURCES_EDIT,
                    delete: Permission.KNOWLEDGE_SOURCES_DELETE,
                    // export: Permission.KNOWLEDGE_SOURCES_EXPORT,
                },
            },
            {
                name: 'Storage (Files)',
                description: 'Files and folders in organization storage',
                actions: {
                    view: Permission.STORAGE_VIEW,
                    create: Permission.STORAGE_CREATE,
                    edit: Permission.STORAGE_EDIT,
                    delete: Permission.STORAGE_DELETE,
                    export: Permission.STORAGE_EXPORT,
                },
            },
            {
                name: 'Chats',
                description: 'Speak with agents',
                actions: {
                    view: Permission.CHATS_VIEW,
                    create: Permission.CHATS_CREATE,
                    edit: Permission.CHATS_EDIT,
                    delete: Permission.CHATS_DELETE,
                    // export: Permission.CHATS_EXPORT,
                },
            },
        ],
    },
    {
        name: 'Configuration & Secrets',
        icon: 'settings',
        resources: [
            {
                name: 'LLM Configs',
                description: 'LLM model configurations and settings',
                actions: {
                    view: Permission.LLM_CONFIGS_VIEW,
                    create: Permission.LLM_CONFIGS_CREATE,
                    edit: Permission.LLM_CONFIGS_EDIT,
                    delete: Permission.LLM_CONFIGS_DELETE,
                    // export: Permission.LLM_CONFIGS_EXPORT,
                },
            },
            {
                name: 'API Keys / Secrets',
                description: 'Provider API keys, credentials, sensitive config',
                actions: {
                    view: Permission.API_KEYS_VIEW,
                    create: Permission.API_KEYS_CREATE,
                    edit: Permission.API_KEYS_UPDATE,
                    delete: Permission.API_KEYS_DELETE,
                    // export: Permission.API_KEYS_EXPORT,
                },
            },
        ],
    },
    {
        name: 'Workflows',
        icon: 'play',
        resources: [
            {
                name: 'Flows',
                description: 'Automation pipelines',
                actions: {
                    view: Permission.WORKFLOW_FLOWS_VIEW,
                    create: Permission.WORKFLOW_FLOWS_CREATE,
                    edit: Permission.WORKFLOW_FLOWS_EDIT,
                    delete: Permission.WORKFLOW_FLOWS_DELETE,
                    export: Permission.WORKFLOW_FLOWS_EXPORT,
                },
            },
            {
                name: 'Sessions',
                description: 'Flow sessions',
                actions: {
                    view: Permission.SESSIONS_VIEW,
                    create: Permission.SESSIONS_CREATE,
                    // edit:   Permission.SESSIONS_EDIT,
                    delete: Permission.SESSIONS_DELETE,
                    export: Permission.SESSIONS_EXPORT,
                },
            },
            {
                name: 'Templates',
                description: 'Reusable flow presets',
                actions: {
                    view: Permission.TEMPLATES_VIEW,
                    create: Permission.TEMPLATES_CREATE,
                    edit: Permission.TEMPLATES_EDIT,
                    delete: Permission.TEMPLATES_DELETE,
                    export: Permission.TEMPLATES_EXPORT,
                },
            },
        ],
    },
    {
        name: 'Knowledge Sources',
        icon: 'database',
        resources: [
            {
                name: 'Collections',
                description: 'Article grouping',
                actions: {
                    view: Permission.COLLECTIONS_VIEW,
                    create: Permission.COLLECTIONS_CREATE,
                    edit: Permission.COLLECTIONS_EDIT,
                    delete: Permission.COLLECTIONS_DELETE,
                    export: Permission.COLLECTIONS_EXPORT,
                },
            },
            {
                name: 'Naive RAG',
                description: 'Self-built Augmented Generation',
                actions: {
                    view: Permission.NAIVE_RAG_VIEW,
                    create: Permission.NAIVE_RAG_CREATE,
                    edit: Permission.NAIVE_RAG_EDIT,
                    delete: Permission.NAIVE_RAG_DELETE,
                    export: Permission.NAIVE_RAG_EXPORT,
                },
            },
            {
                name: 'Graph RAG',
                description: 'Naive Graph-Retrieval-Augmented-Generation',
                actions: {
                    view: Permission.GRAPH_RAG_VIEW,
                    create: Permission.GRAPH_RAG_CREATE,
                    edit: Permission.GRAPH_RAG_EDIT,
                    delete: Permission.GRAPH_RAG_DELETE,
                    export: Permission.GRAPH_RAG_EXPORT,
                },
            },
        ],
    },
];
