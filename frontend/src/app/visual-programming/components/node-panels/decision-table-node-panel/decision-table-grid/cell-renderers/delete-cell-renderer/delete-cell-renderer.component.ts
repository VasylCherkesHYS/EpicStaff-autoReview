import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ICellRendererAngularComp } from 'ag-grid-angular';

@Component({
    selector: 'app-delete-cell-renderer',
    standalone: true,
    imports: [MatTooltipModule],
    template: `
        <i
            class="ti ti-trash"
            matTooltip="Delete row"
            matTooltipPosition="above"
            style="color: #ff3b30; font-size: 1.1rem; transition: all 0.2s ease; cursor: pointer;"
        ></i>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteCellRendererComponent implements ICellRendererAngularComp {
    agInit(): void {}

    refresh(): boolean {
        return true;
    }
}
