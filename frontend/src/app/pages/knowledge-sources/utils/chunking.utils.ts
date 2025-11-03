import { Observable, of, switchMap, timer } from "rxjs";
import { SourceEmbeddingService } from "../services/source-embedding.service";
import { PreviewChunks } from "../models/embedding-result.model";
import { map, catchError, switchMap as rxSwitchMap, filter, take, catchError as rxCatchError } from 'rxjs/operators';


export function getChunkingPreview(
    sourceEmbeddingService: SourceEmbeddingService,
    documentId: number
): Observable<PreviewChunks> {
    if (!documentId) {
        console.warn('No server document_id found for selected file. Cannot request chunk preview.');
        return of({ results: [], previous: null, count: 0, next: null } as PreviewChunks);
    }

    // Start chunking job, then poll the result endpoint until we get non-empty results
    // or until maxAttempts is reached. This avoids leaving the UI stuck in loading
    // state when the server needs time to prepare chunks.
    const pollIntervalMs = 1000; // 1s between attempts
    const maxAttempts = 30; // wait up to ~30s

    return sourceEmbeddingService.createDocumentChunking(documentId).pipe(
        switchMap(() =>
            // poll immediately, then every pollIntervalMs
            timer(0, pollIntervalMs).pipe(
                rxSwitchMap(() => sourceEmbeddingService.getResultDocumentChunking(documentId) as unknown as Observable<PreviewChunks>),
                map((res: PreviewChunks | null | undefined) => {
                    if (!res || !res.results?.length) {
                        return null;
                    }
                    return res;
                }),
                // only pass through when we have a real result
                filter((r) => r !== null),
                // take the first non-null result or complete after maxAttempts
                take(1),
                // if polling fails or times out, catch and return empty preview
                rxCatchError(err => {
                    console.error('Chunk preview polling failed', err);
                    return of({ results: [], previous: null, count: 0, next: null } as PreviewChunks);
                })
            )
        ),
        // final safeguard: if anything else errors, return empty preview
        catchError(err => {
            console.error('Chunk preview or reading failed', err);
            return of({ results: [], previous: null, count: 0, next: null } as PreviewChunks);
        })
    );
}
