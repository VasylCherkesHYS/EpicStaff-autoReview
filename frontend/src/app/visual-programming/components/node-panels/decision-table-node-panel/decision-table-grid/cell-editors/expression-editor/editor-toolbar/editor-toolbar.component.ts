import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
    selector: 'app-editor-toolbar',
    standalone: true,
    imports: [],
    templateUrl: './editor-toolbar.component.html',
    styleUrls: ['./editor-toolbar.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditorToolbarComponent {
    public mode = input<'condition' | 'manipulation'>('condition');
    public tokenInserted = output<string>();

    public insertToken(token: string): void {
        this.tokenInserted.emit(token);
    }
}
