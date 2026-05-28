import { Dialog } from '@angular/cdk/dialog';
import { ComponentType } from '@angular/cdk/overlay';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppSvgIconComponent } from '@shared/components';
import { switchMap } from 'rxjs/operators';

import { GraphRagConfigurationDialog } from '../../../../../components/rag-configuration-dialog/graph-rag-configuration-dialog/graph-rag-configuration-dialog.component';
import { NaiveRagConfigurationDialog } from '../../../../../components/rag-configuration-dialog/naive-rag-configuration-dialog/naive-rag-configuration-dialog.component';
import { RagConfigurationDialogComponent } from '../../../../../components/rag-configuration-dialog/rag-configuration-dialog.component';
import { RAG_STATUS_CONFIG, RAG_TYPE_CONFIG } from '../../../../../constants/constants';
import { RagType } from '../../../../../models/base-rag.model';
import { CreateCollectionDtoResponse } from '../../../../../models/collection.model';
import { CollectionsStorageService } from '../../../../../services/collections-storage.service';

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
    private collectionsStorageService = inject(CollectionsStorageService);

    collection = input.required<CreateCollectionDtoResponse>();
    onCreateRag = output<RagType>();

    ragTypeConfig = RAG_TYPE_CONFIG;
    ragStatusConfig = RAG_STATUS_CONFIG;

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
        const collectionId = this.collection().collection_id;
        const dialog = this.dialog.open(dialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            data: { ragId, collectionId },
            disableClose: true,
        });

        dialog.closed
            .pipe(
                switchMap(() => this.collectionsStorageService.getFullCollection(collectionId, true)),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe();
    }
}
