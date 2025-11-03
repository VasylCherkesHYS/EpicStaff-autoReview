import { Source } from './source.model';

export type ChunkStrategy =
  | 'token'
  | 'character'
  | 'markdown'
  | 'json'
  | 'html';

export interface AdditionalParams {
  character: Character,
  csvStrategy: CsvStrategy,
  markdown: Markdown,
  html: HTMLStrategy,
}

export interface Character {
  regex: string,
}

export interface CsvStrategy {
  rows_in_chunk: number,
  headers_level: number
}

export interface Markdown {
  headers_to_split_on: string[],
  return_each_line: boolean,
  strip_headers: boolean
}

export interface HTMLStrategy {
  preserve_links: boolean,
  normalize_text: boolean,
  external_metadata?: ExternalMetadata,
  denylist_tags?: string[]
}

interface ExternalMetadata {
  [key: string]: string;
}


export interface FileWithSettings {
  file: File;
  chunkStrategy: ChunkStrategy;
  chunkSize: number;
  overlapSize: number;
  isValid: boolean; // Track file validity
  hasChunkSizeError?: boolean; // Track chunk size validation
  // Server-assigned document id (populated after creating draft/upload)
  document_id?: number;
  // additionalParams?: AdditionalParams;
}

export enum CollectionStatus {
  NEW = 'new',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  WARNING = 'warning',
}
export interface GetSourceCollectionRequest {
  collection_id: number;
  collection_name: string;
  user_id: string;
  collection_status?: CollectionStatus;
  status?: CollectionStatus;
  embedder: number;
  created_at: string;
  document_metadata: Source[];
  additional_params: {};
  is_draft: boolean;
}

export interface CreateGetSourceCollectionRequestRequest {
  collection_name: string;
  user_id: string;
  embedder: string;
  files: File[];
  chunk_sizes: number[];
  chunk_strategies: ChunkStrategy[];
  chunk_overlaps: number[];
  additional_params: {};
}


export interface FileWithIndex {
  file: FileWithSettings;
  index: number;
}