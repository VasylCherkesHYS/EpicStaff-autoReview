import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonComponent } from '@shared/components';
import { filter, switchMap } from 'rxjs/operators';

import { INDEXING_CONFIRMATION_DATA } from '../../../constants/indexing-confirmation-data';
import { NaiveRagService } from '../../../services/naive-rag.service';
import { NaiveRagConfigurationComponent } from '../../naive-rag-configuration/naive-rag-configuration.component';
import { RagConfigurationDialogComponent } from '../rag-configuration-dialog.component';

@Component({
    selector: 'app-naive-rag-configuration-dialog',
    templateUrl: './naive-rag-configuration-dialog.component.html',
    styleUrls: ['../rag-configuration-dialog.component.scss'],
    imports: [NaiveRagConfigurationComponent, ButtonComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaiveRagConfigurationDialog extends RagConfigurationDialogComponent {
    private naiveRagService = inject(NaiveRagService);

    onClose(): void {
        this.dialogRef.close();
    }

    runIndexing(): void {
        this.confirmation
            .confirm(INDEXING_CONFIRMATION_DATA)
            .pipe(
                filter((result) => result === true),
                switchMap(() =>
                    this.naiveRagService.startIndexing({
                        rag_id: this.data.ragId,
                        rag_type: 'naive',
                    })
                ),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: () => this.toast.success('Files re-indexed successfully'),
                error: () => this.toast.error('Files re-indexing failed'),
            });
    }
}
