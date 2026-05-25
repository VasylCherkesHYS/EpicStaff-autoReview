export type FlowSortOrder = 'default' | 'name_asc' | 'name_desc';

export type FilterOperator =
    | 'equals'
    | 'not_equals'
    | 'starts_with'
    | 'not_starts_with'
    | 'ends_with'
    | 'not_ends_with'
    | 'contains'
    | 'not_contains';

export type LogicalCombinator = 'AND' | 'OR';

export type CustomFilterScope = 'flow_name' | 'label_name';

export interface CustomFilterClause {
    operator: FilterOperator;
    value: string;
}

export interface CustomFilterCondition {
    scope: CustomFilterScope;
    primary: CustomFilterClause;
    combinator: LogicalCombinator;
    secondary?: CustomFilterClause;
}

export interface FlowsFilterState {
    searchTerm: string;
    sortOrder: FlowSortOrder;
    includedFlowIds: number[] | null;
    includedLabelIds: number[] | null;
    customFilter: CustomFilterCondition | null;
}

export const EMPTY_FLOWS_FILTER: FlowsFilterState = {
    searchTerm: '',
    sortOrder: 'default',
    includedFlowIds: null,
    includedLabelIds: null,
    customFilter: null,
};

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
    equals: 'Equals',
    not_equals: 'Does not equal',
    starts_with: 'Starts with',
    not_starts_with: "Doesn't start with",
    ends_with: 'Ends with',
    not_ends_with: 'Does not end with',
    contains: 'Contains',
    not_contains: 'Does not contain',
};

export const FILTER_OPERATOR_ORDER: FilterOperator[] = [
    'equals',
    'not_equals',
    'starts_with',
    'not_starts_with',
    'ends_with',
    'not_ends_with',
    'contains',
    'not_contains',
];
