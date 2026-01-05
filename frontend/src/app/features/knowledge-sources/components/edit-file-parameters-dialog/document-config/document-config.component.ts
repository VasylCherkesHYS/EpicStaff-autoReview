import {ChangeDetectionStrategy, Component, input, signal} from "@angular/core";
import {MATERIAL_FORMS} from "../../../../../shared/material-forms";
import {InputComponent} from "../../../../../shared/components/app-input/input.component";
import {SelectComponent, SelectItem} from "../../../../../shared/components/select/select.component";
import {CHUNK_STRATEGIES_SELECT_ITEMS} from "../../../constants/constants";
import {
    ToggleSwitchComponent
} from "../../../../../shared/components/form-controls/toggle-switch/toggle-switch.component";
import {HeadersInputComponent} from "../../../../../shared/components/chips-input/chips-input.component";
import {JsonEditorComponent} from "../../../../../shared/components/json-editor/json-editor.component";

@Component({
    selector: 'app-document-config',
    templateUrl: './document-config.component.html',
    styleUrls: ['./document-config.component.scss'],
    imports: [
        MATERIAL_FORMS,
        InputComponent,
        SelectComponent,
        ToggleSwitchComponent,
        HeadersInputComponent,
        JsonEditorComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentConfigComponent {
    document = input.required<any>();

    headerItems: SelectItem[] = [
        {
            name: '#header 1',
            value: '1'
        },
        {
            name: '##header 2',
            value: '2'
        },
        {
            name: '###header 3',
            value: '3'
        },
    ]
    selectedHeaders = signal<unknown[]>([])
    selectedStrategy = signal<string>('markdown');

    jsonConfig = signal<string>(JSON.stringify(this.headerItems));
    public isJsonValid = signal<boolean>(true);

    public onJsonValidChange(isValid: boolean): void {
        this.isJsonValid.set(isValid);
    }

    onToggle(value: boolean) {

    }

    protected readonly chunkStrategySelectItems = CHUNK_STRATEGIES_SELECT_ITEMS;
}
