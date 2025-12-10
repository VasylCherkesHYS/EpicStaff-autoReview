import {inject, Injectable, signal} from '@angular/core';
import {catchError, delay, Observable, of, tap} from "rxjs";
import {CollectionsApiService} from "./collections-api.service";
import {CreateCollectionDtoResponse, GetCollectionRequest} from "../models/collection.model";
import {shareReplay} from "rxjs/operators";

@Injectable({
    providedIn: 'root'
})
export class CollectionsStorageService {
    // List of collection preview
    private collectionsSignal = signal<GetCollectionRequest[]>([]);
    private collectionsLoaded = signal<boolean>(false);
    public readonly collections = this.collectionsSignal.asReadonly();
    public readonly isCollectionsLoaded = this.collectionsLoaded.asReadonly();

    // List of collection details
    private fullCollectionsSignal = signal<CreateCollectionDtoResponse[]>([]);
    private fullCollectionsLoaded = signal<boolean>(false);
    // public readonly fullCollections = this.fullCollectionsSignal.asReadonly();
    // public readonly isFullCollectionsLoaded = this.fullCollectionsLoaded.asReadonly();

    private readonly collectionsApiService = inject(CollectionsApiService);

    createCollection(): Observable<CreateCollectionDtoResponse> {
        return this.collectionsApiService.createCollection().pipe(
            tap((newCollection: CreateCollectionDtoResponse) => {
                const { rag_configurations, ...rest } = newCollection;
                this.addCollectionToCache(rest);
            })
        );
    }

    public addCollectionToCache(newCollection: GetCollectionRequest) {
        const currentCollections = this.collectionsSignal();
        if (!currentCollections.some((c) => c.collection_id === newCollection.collection_id)) {
            this.collectionsSignal.set([newCollection, ...currentCollections]);
        }
    }

    getCollections(forceRefresh = false): Observable<GetCollectionRequest[]> {
        if (this.collectionsLoaded() && !forceRefresh) {
            return of(this.collectionsSignal());
        }
        return this.collectionsApiService.getCollections().pipe(
            tap((collections) => {
                this.setCollections(collections);
            }),
            delay(this.collectionsLoaded() ? 0 : 300),
            shareReplay(1),
            catchError(() => {
                this.collectionsLoaded.set(false);
                return of([]);
            })
        );
    }

    setCollections(collections: GetCollectionRequest[]) {
        this.collectionsSignal.set(collections);
        this.collectionsLoaded.set(true);
    }

    getFullCollection(id: number): Observable<CreateCollectionDtoResponse | null> {
        const cachedCollection = this.fullCollectionsSignal().find(
            (c) => c.collection_id === id
        );
        if (cachedCollection) {
            return of(cachedCollection);
        }

        return this.collectionsApiService.getCollectionById(id).pipe(
            tap((newCollection: CreateCollectionDtoResponse) => {
                this.fullCollectionsSignal.update(collections => [...collections, newCollection]);
            }),
            delay(this.fullCollectionsLoaded() ? 0 : 300),
            shareReplay(1),
            catchError(() => of(null))
        );
    }

    updateCollectionById(id: number, body: Partial<CreateCollectionDtoResponse>): Observable<CreateCollectionDtoResponse> {
        return this.collectionsApiService.updateCollectionById(id, body).pipe(
            tap(updated => this.updateCollectionInCache(updated)),
            catchError(() => of())
        );
    }

    deleteCollectionById(id: number): Observable<void> {
        return this.collectionsApiService.deleteCollectionById(id).pipe(
            tap(() => this.deleteCollectionFromCache(id))
        );
    }

    private updateCollectionInCache(updated: CreateCollectionDtoResponse): void {
        const { rag_configurations, ...rest } = updated;
        this.collectionsSignal.update(collections =>
            collections.map(c =>
                c.collection_id === rest.collection_id ? rest : c
            )
        );

        this.fullCollectionsSignal.update(collections =>
            collections.map(c =>
                c.collection_id === updated.collection_id ? updated : c
            )
        );
    }

    private deleteCollectionFromCache(id: number) {
        const currentCollections = this.collectionsSignal();
        const updatedCollections = currentCollections.filter(
            (p) => p.collection_id !== id
        );
        this.collectionsSignal.set(updatedCollections);

        const currentFullCollections = this.fullCollectionsSignal();
        const updatedFullCollections = currentFullCollections.filter(
            (p) => p.collection_id !== id
        );
        this.fullCollectionsSignal.set(updatedFullCollections);
    }
}
