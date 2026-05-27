import { Dialog } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppSvgIconComponent } from '@shared/components';

import { GraphRagConfigurationDialog } from '../../../../../components/rag-configuration-dialog/graph-rag-configuration-dialog/graph-rag-configuration-dialog.component';
import { NaiveRagConfigurationDialog } from '../../../../../components/rag-configuration-dialog/naive-rag-configuration-dialog/naive-rag-configuration-dialog.component';
import { RagConfigurationDialogComponent } from '../../../../../components/rag-configuration-dialog/rag-configuration-dialog.component';
import { RagStatus, RagType } from '../../../../../models/base-rag.model';
import { CreateCollectionDtoResponse } from '../../../../../models/collection.model';

@Component({
    selector: 'app-collection-details-rags',
    templateUrl: 'collection-rags.component.html',
    styleUrls: ['./collection-rags.component.scss'],
    imports: [AppSvgIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionRagsComponent {
    private dialog = inject(Dialog);
    private destroyRef = inject(DestroyRef);

    collection = input.required<CreateCollectionDtoResponse>();
    onCreateRag = output<RagType>();

    ragTypeConfig: Record<RagType, { name: string; icon: string }> = {
        naive: {
            name: 'Naive RAG',
            icon: 'mouse',
        },
        graph: {
            name: 'Graph RAG',
            icon: 'web',
        },
        hybrid: {
            name: 'Hybrid RAG',
            icon: 'tab-group',
        },
    };

    ragStatusConfig: Record<RagStatus, { color: string; icon: string; text: string }> = {
        new: {
            color: 'var(--color-ks-status-blue)',
            icon: 'processing',
            text: 'Processing',
        },
        completed: {
            color: 'var(--color-ks-status-completed)',
            icon: 'check',
            text: 'Completed',
        },
        processing: {
            color: 'var((--color-ks-status-blue)',
            icon: 'processing',
            text: 'Processing',
        },
        warning: {
            color: 'var(--color-ks-status-warning)',
            icon: 'warning',
            text: 'Warning',
        },
        failed: {
            color: 'var(--color-ks-status-failed)',
            icon: 'x',
            text: 'Failed',
        },
    };

    onConfigureRag(type: RagType): void {
        const ragConfigurations = this.collection().rag_configurations;
        const ragConfig = ragConfigurations.find((i) => i.rag_type === type);

        if (!ragConfigurations.length || !ragConfig) {
            this.onCreateRag.emit(type);
            return;
        }

        if (type === 'naive') {
            this.openRagConfigurationDialog(ragConfig.rag_id, NaiveRagConfigurationDialog);
            return;
        }

        if (type === 'graph') {
            this.openRagConfigurationDialog(ragConfig.rag_id, GraphRagConfigurationDialog);
            return;
        }
    }

    private openRagConfigurationDialog(
        ragId: number,
        dialogComponent: ComponentType<RagConfigurationDialogComponent>
    ): void {
        const dialog = this.dialog.open(dialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            data: { ragId, collectionId: this.collection().collection_id },
            disableClose: true,
        });

        dialog.closed.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    }
}
