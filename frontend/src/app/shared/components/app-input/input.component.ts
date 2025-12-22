import {
    Component,
    ChangeDetectionStrategy,
    input, output, model, signal,
} from '@angular/core';
import {FormsModule} from "@angular/forms";
import {NgClass} from "@angular/common";

@Component({
    selector: 'app-input',
    templateUrl: './input.component.html',
    styleUrls: ['./input.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        NgClass
    ]
})
export class InputComponent {
    type = input<'text' | 'number'>('text');
    mod = input<'default' | 'small'>('default');
    placeholder = input<string>('Type here');
    invalid = input<boolean>(false);
    value = model<string | number>('');
    changed = output<string | number>();

    hovered = signal<boolean>(false);

    onInputChange(value: string | number) {
        if (this.type() === 'text') {
            this.changed.emit(value?.toString() ?? '');
            return;
        }

        if (this.type() === 'number') {
            const num = Number(value);

            if (Number.isNaN(num)) return;

            this.value.set(value);
            this.changed.emit(num);
        }
    }

    step(delta: number) {
        const current = Number(this.value()) || 0;
        this.onInputChange(current + delta);
    }
}
