import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '@shared/components';
import { interval, merge } from 'rxjs';
import { filter, switchMap, takeWhile, tap } from 'rxjs/operators';

import { getReindexingConfirmationData } from '../../../helpers/get-indexing-confirmation-data.util';
import { NaiveRagService } from '../../../services/naive-rag.service';
import { NaiveRagDocumentsStorageService } from '../../../services/naive-rag-documents-storage.service';
import { NaiveRagConfigurationComponent } from '../../naive-rag-configuration/naive-rag-configuration.component';
import { RagConfigurationDialogComponent } from '../rag-configuration-dialog.component';

const POLL_INTERVAL_MS = 2500;

@Component({
    selector: 'app-naive-rag-configuration-dialog',
    templateUrl: './naive-rag-configuration-dialog.component.html',
    styleUrls: ['../rag-configuration-dialog.component.scss'],
    imports: [NaiveRagConfigurationComponent, ButtonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaiveRagConfigurationDialog extends RagConfigurationDialogComponent {
    private naiveRagService = inject(NaiveRagService);
    private documentsStorageService = inject(NaiveRagDocumentsStorageService);
    private ragConfiguration = viewChild.required(NaiveRagConfigurationComponent);

    onClose(): void {
        this.dialogRef.close();
    }

    runIndexing(): void {
        const { configIds, fileNames } = this.ragConfiguration().getDocumentsForIndexing();
        if (!fileNames.length) return;

        this.confirmation
            .confirm(getReindexingConfirmationData(fileNames))
            .pipe(
                filter((result) => result === true),
                switchMap(() =>
                    this.naiveRagService.startIndexing({
                        rag_id: this.data.ragId,
                        rag_type: 'naive',
                        ...(configIds && { document_config_ids: configIds }),
                    })
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: () => {
                    this.toast.success('Indexing started');
                    this.pollDocumentStatuses(configIds);
                },
                error: () => this.toast.error('Files re-indexing failed'),
            });
    }

    private pollDocumentStatuses(configIds?: number[]): void {
        const idsToTrack = configIds ?? this.documentsStorageService.documents().map((d) => d.naive_rag_document_id);
        if (!idsToTrack.length) return;

        this.documentsStorageService.setDocumentStatuses(idsToTrack, 'indexing');

        const polls = idsToTrack.map((docId) =>
            interval(POLL_INTERVAL_MS).pipe(
                switchMap(() => this.naiveRagService.getDocumentConfigById(this.data.ragId, docId)),
                tap((config) => this.documentsStorageService.updateDocumentFromConfig(config)),
                takeWhile((config) => config.status === 'chunking' || config.status === 'indexing', true)
            )
        );

        merge(...polls)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
    }
}
