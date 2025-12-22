export interface GetAgentNaiveRagResponse {
    naive_rag_id: number;
    rag_status: string;
    collection_id: number;
    created_at: string;
    indexed_at: string | null;
}
