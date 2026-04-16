import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    AppTableCellDirective,
    AppTableColumnDef,
    AppTableComponent,
    ButtonComponent,
    CustomInputComponent,
    SearchComponent,
    SelectComponent,
    SelectItem,
    TableRow,
    ValidationErrorsComponent,
} from '@shared/components';

const ROLE_ITEMS: SelectItem[] = [
    { name: 'User', value: 'user' },
    { name: 'Admin', value: 'admin' },
    { name: 'Super Admin', value: 'super_admin' },
    { name: 'Flow Designer', value: 'flow_designer' },
    { name: 'Knowledge Specialist', value: 'knowledge_specialist' },
    { name: 'Python Developer', value: 'python_developer' },
];

const MOCK_USERS: TableRow[] = [
    { id: 1, initials: 'IB', name: 'Ivan Bohun', email: 'ivan_bohun@gmail.com', role: 'user' },
    { id: 2, initials: 'IV', name: 'Ivan Vyhovskyi', email: 'ivan_vyhovskyi@gmail.com', role: 'user' },
    { id: 3, initials: 'BK', name: 'Bohdan Khmelnytsky', email: 'bohdan_khmelnytsky@gmail.com', role: 'user' },
];

@Component({
    selector: 'app-create-organization-dialog',
    templateUrl: './create-organization-dialog.component.html',
    styleUrls: ['./create-organization-dialog.component.scss'],
    imports: [
        ButtonComponent,
        ReactiveFormsModule,
        ValidationErrorsComponent,
        CustomInputComponent,
        AppTableComponent,
        AppTableCellDirective,
        SelectComponent,
        SearchComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateOrganizationDialogComponent {
    private dialogRef = inject(DialogRef);

    orgNameControl = new FormControl('', [Validators.required, Validators.minLength(3), Validators.maxLength(50)]);

    readonly roleItems = ROLE_ITEMS;
    readonly users = MOCK_USERS;

    readonly columns: AppTableColumnDef[] = [
        { key: 'user', label: 'User', width: '1fr' },
        { key: 'role', label: 'System Role', width: '1fr', filterItems: ROLE_ITEMS },
    ];

    readonly selectedUsers = signal<TableRow[]>([]);

    onSelection(items: TableRow[]): void {
        this.selectedUsers.set(items);
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onCreate(): void {
        // TODO: submit selectedUsers with orgNameControl.value
    }
}
