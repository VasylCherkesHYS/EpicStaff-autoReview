export enum RagTypeLevel {
    BASIC = 'Basic',
    ADVANCED = 'Advanced',
    EXPERT = 'Expert',
}

export enum RagTypeName {
    NAIVE_RAG = 'Naive RAG',
    GRAPH_RAG = 'Graph RAG',
    MULTIPLE_RAG = 'Multiple RAG',
}

export interface RagType {
    name: RagTypeName;
    description: string;
    tip: string;
    icon: string;
    level: RagTypeLevel;
    stars: number;
}
