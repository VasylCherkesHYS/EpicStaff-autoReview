import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-value-preview-tooltip',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './value-preview-tooltip.component.html',
    styleUrls: ['./value-preview-tooltip.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValuePreviewTooltipComponent {
    public value = input<any>(null);
    public position = input<'left' | 'right'>('right');

    public isObject = computed(() => {
        const current = this.value();
        return current !== null && typeof current === 'object';
    });
}

