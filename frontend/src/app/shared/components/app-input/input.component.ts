import {
    Component,
    ChangeDetectionStrategy,
    input, output, model,
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
    value = model<string | number>('');
    changed = output<string | number>();

    onInputChange(value: string | number) {
        if (this.type() === 'text') {
            this.changed.emit(value?.toString() ?? '');
            return;
        }

        if (this.type() === 'number') {
            const num = Number(value);

            if (Number.isNaN(num)) return;

            this.changed.emit(num);
        }
    }
}
