import { GetSourceCollectionRequest } from "./source-collection.model";

export interface ResultChunkItem {
    id: number,
    text: string
}

export type ResultChunkItemArray = ResultChunkItem[];

export interface PreviewChunks {
    results: ResultChunkItemArray,
    previous: null,
    count: number,
    next: null
}

export interface ProcessDocumentChunkingRequest {
    "document_id": number
}

export interface ProcessCollectionEmbeddingRequest {
    "collection_id": number
}


// export interface GetProcessCollectionEmbeddingRequest {
//     "collection_id": number
// }

export interface GetProcessingEmbeddingResponse {
    count: number,
    next: null,
    previous: null,
    results: GetSourceCollectionRequest[]
}
