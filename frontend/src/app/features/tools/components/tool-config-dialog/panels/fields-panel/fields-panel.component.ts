import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PythonCodeToolConfigField, ToolConfigFieldType } from '../../../../models/python-code-tool.model';
import { PythonCodeToolConfigFieldService, CreateConfigFieldRequest } from '../../../../services/custom-tools/python-code-tool-config-field.service';
import { ToastService } from '../../../../../../services/notifications/toast.service';
import { TcfInputComponent, TcfTextareaComponent, TcfSelectComponent, TcfSelectOption, TcfCheckboxComponent } from '../../ui';

const FIELD_TYPES: { value: ToolConfigFieldType; label: string }[] = [
  { value: 'string', label: 'Text' },
  { value: 'integer', label: 'Integer' },
  { value: 'float', label: 'Decimal' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'llm_config', label: 'LLM Config' },
  { value: 'embedding_config', label: 'Embedding Config' },
  { value: 'any', label: 'Any (JSON)' },
];

@Component({
  selector: 'app-fields-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    TcfInputComponent,
    TcfTextareaComponent,
    TcfSelectComponent,
    TcfCheckboxComponent,
  ],
  templateUrl: './fields-panel.component.html',
  styleUrl: './fields-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldsPanelComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fieldService = inject(PythonCodeToolConfigFieldService);
  private readonly toastService = inject(ToastService);

  toolId = input.required<number>();
  initialFields = input.required<PythonCodeToolConfigField[]>();

  fieldsChanged = output<PythonCodeToolConfigField[]>();

  readonly fields = signal<PythonCodeToolConfigField[]>([]);
  readonly selectedField = signal<PythonCodeToolConfigField | null>(null);
  readonly isCreating = signal(false);
  readonly isSaving = signal(false);
  backendErrorMessage: string | null = null;

  readonly showForm = computed(() => this.selectedField() !== null || this.isCreating());

  readonly fieldTypeOptions: TcfSelectOption[] = FIELD_TYPES.map(t => ({ value: t.value, label: t.label }));

  fieldForm = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    description: new FormControl(''),
    data_type: new FormControl<ToolConfigFieldType>('string', [Validators.required]),
    required: new FormControl(false),
    secret: new FormControl(false),
  });

  constructor() {
    effect(() => {
      this.fields.set(this.initialFields());
    }, { allowSignalWrites: true });
    this.setupFieldFormWatchers();
  }

  selectField(field: PythonCodeToolConfigField): void {
    this.isCreating.set(false);
    this.selectedField.set(field);
    this.fieldForm.patchValue({
      name: field.name,
      description: field.description,
      data_type: field.data_type,
      required: field.required,
      secret: field.secret,
    });
    this.backendErrorMessage = null;
  }

  startNew(): void {
    this.selectedField.set(null);
    this.isCreating.set(true);
    this.fieldForm.reset({
      name: '',
      description: '',
      data_type: 'string',
      required: false,
      secret: false,
    });
    this.backendErrorMessage = null;
  }

  cancel(): void {
    this.selectedField.set(null);
    this.isCreating.set(false);
    this.fieldForm.reset();
    this.backendErrorMessage = null;
  }

  save(): void {
    if (this.fieldForm.invalid) {
      this.fieldForm.markAllAsTouched();
      this.toastService.error('Please fill in all required fields');
      return;
    }

    this.isSaving.set(true);
    this.backendErrorMessage = null;

    const formValue = this.fieldForm.value;
    const payload: CreateConfigFieldRequest = {
      tool: this.toolId(),
      name: formValue.name || '',
      description: formValue.description || '',
      data_type: formValue.data_type || 'string',
      required: formValue.required || false,
      secret: formValue.data_type === 'string' ? !!formValue.secret : false,
    };

    const selected = this.selectedField();
    if (selected) {
      this.fieldService.updateField(selected.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            const current = this.fields();
            const idx = current.findIndex(f => f.id === updated.id);
            if (idx !== -1) {
              const newList = [...current];
              newList[idx] = updated;
              this.fields.set(newList);
              this.fieldsChanged.emit(newList);
            }
            this.selectedField.set(updated);
            this.toastService.success(`Field "${updated.name}" updated`);
            this.isSaving.set(false);
          },
          error: (err) => {
            this.handleError(err);
            this.isSaving.set(false);
          },
        });
    } else {
      this.fieldService.createField(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            const newList = [...this.fields(), created];
            this.fields.set(newList);
            this.fieldsChanged.emit(newList);
            this.selectedField.set(created);
            this.isCreating.set(false);
            this.toastService.success(`Field "${created.name}" created`);
            this.isSaving.set(false);
          },
          error: (err) => {
            this.handleError(err);
            this.isSaving.set(false);
          },
        });
    }
  }

  delete(): void {
    const field = this.selectedField();
    if (!field || !confirm(`Delete field "${field.name}"? This will affect existing configs.`)) return;

    this.fieldService.deleteField(field.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const newList = this.fields().filter(f => f.id !== field.id);
          this.fields.set(newList);
          this.fieldsChanged.emit(newList);
          this.selectedField.set(null);
          this.isCreating.set(false);
          this.toastService.success(`Field "${field.name}" deleted`);
        },
        error: (err) => this.handleError(err),
      });
  }

  private handleError(error: any): void {
    console.error('Error:', error);
    this.backendErrorMessage = this.extractErrorMessage(error);
    this.toastService.error(this.backendErrorMessage || 'An error occurred');
  }

  private extractErrorMessage(error: any): string {
    if (error?.error) {
      if (typeof error.error === 'string') return error.error;
      if (error.error.message) return error.error.message;
      if (error.error.detail) return error.error.detail;
      if (error.error.name && Array.isArray(error.error.name)) return error.error.name[0];
    }
    return error?.message || 'An unexpected error occurred';
  }

  getFieldError(fieldName: string): string | null {
    const ctrl = this.fieldForm.get(fieldName);
    if (ctrl?.invalid && (ctrl?.dirty || ctrl?.touched)) {
      if (ctrl.errors?.['required']) return 'Required';
      if (ctrl.errors?.['maxlength']) return `Max ${ctrl.errors['maxlength'].requiredLength} chars`;
    }
    return null;
  }

  isSecretToggleVisible(): boolean {
    return this.fieldForm?.get('data_type')?.value === 'string';
  }

  private setupFieldFormWatchers(): void {
    const dataTypeControl = this.fieldForm.get('data_type');
    dataTypeControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dataType: ToolConfigFieldType | null) => {
        if (dataType !== 'string') {
          this.fieldForm.get('secret')?.setValue(false, { emitEvent: false });
        }
      });
  }

  getFieldTypeLabel(dataType: string): string {
    return FIELD_TYPES.find(t => t.value === dataType)?.label || dataType;
  }
}

