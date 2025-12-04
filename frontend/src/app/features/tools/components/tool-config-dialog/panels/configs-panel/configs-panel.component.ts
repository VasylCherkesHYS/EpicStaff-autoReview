import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  OnInit,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PythonCodeToolConfigField, ToolConfigFieldType } from '../../../../models/python-code-tool.model';
import { PythonCodeToolConfig, CreatePythonCodeToolConfigRequest } from '../../../../models/tool_config.model';
import { PythonCodeToolConfigService } from '../../../../services/custom-tools/python-code-tool-config.service';
import { ToastService } from '../../../../../../services/notifications/toast.service';
import { FullLLMConfig } from '../../../../../../services/full-llm-config.service';
import { FullEmbeddingConfig } from '../../../../../../services/full-embedding.service';
import { TcfInputComponent, TcfTextareaComponent, TcfSelectComponent, TcfSelectOption, TcfCheckboxComponent, TcfCodeEditorComponent } from '../../ui';

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
  selector: 'app-configs-panel',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatIconModule,
    TcfInputComponent,
    TcfTextareaComponent,
    TcfSelectComponent,
    TcfCheckboxComponent,
    TcfCodeEditorComponent,
  ],
  templateUrl: './configs-panel.component.html',
  styleUrl: './configs-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigsPanelComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(PythonCodeToolConfigService);
  private readonly toastService = inject(ToastService);

  toolId = input.required<number>();
  toolFields = input.required<PythonCodeToolConfigField[]>();
  llmConfigs = input.required<FullLLMConfig[]>();
  embeddingConfigs = input.required<FullEmbeddingConfig[]>();
  initialConfigs = input.required<PythonCodeToolConfig[]>();

  configsChanged = output<PythonCodeToolConfig[]>();

  readonly configs = signal<PythonCodeToolConfig[]>([]);
  readonly selectedConfig = signal<PythonCodeToolConfig | null>(null);
  readonly isCreating = signal(false);
  readonly isSaving = signal(false);
  backendErrorMessage: string | null = null;

  configForm!: FormGroup;

  readonly showForm = computed(() => this.selectedConfig() !== null || this.isCreating());
  readonly hasFields = computed(() => this.toolFields().length > 0);

  readonly llmConfigOptions = computed<TcfSelectOption[]>(() => [
    { value: null, label: '-- None --' },
    ...this.llmConfigs().map(llm => ({
      value: llm.id,
      label: `${llm.custom_name} · ${llm.modelDetails?.name || 'Unknown'}`,
    })),
  ]);

  readonly embeddingConfigOptions = computed<TcfSelectOption[]>(() => [
    { value: null, label: '-- None --' },
    ...this.embeddingConfigs().map(emb => ({
      value: emb.id,
      label: `${emb.custom_name} · ${emb.modelDetails?.name || 'Unknown'}`,
    })),
  ]);

  constructor() {
    effect(() => {
      this.configs.set(this.initialConfigs());
    }, { allowSignalWrites: true });

    effect(() => {
      this.toolFields();
      this.rebuildForm();
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.rebuildForm();
  }

  private rebuildForm(): void {
    const controls: Record<string, FormControl> = {
      name: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    };

    for (const field of this.toolFields()) {
      controls[field.name] = new FormControl(
        this.getDefaultValue(field.data_type),
        this.getValidators(field)
      );
    }

    this.configForm = new FormGroup(controls);
  }

  private getValidators(field: PythonCodeToolConfigField): any[] {
    const validators: any[] = [];
    if (field.required) validators.push(Validators.required);

    switch (field.data_type) {
      case 'integer':
        validators.push(Validators.pattern(/^-?\d+$/));
        break;
      case 'float':
        validators.push(Validators.pattern(/^-?\d*\.?\d+$/));
        break;
      case 'string':
        validators.push(Validators.maxLength(2000));
        break;
      case 'llm_config':
      case 'embedding_config':
        if (field.required) validators.push(Validators.min(1));
        break;
    }
    return validators;
  }

  private getDefaultValue(dataType: ToolConfigFieldType): any {
    switch (dataType) {
      case 'boolean': return false;
      case 'integer':
      case 'float':
      case 'llm_config':
      case 'embedding_config': return null;
      default: return '';
    }
  }

  selectConfig(config: PythonCodeToolConfig): void {
    this.isCreating.set(false);
    this.selectedConfig.set(config);
    this.populateForm(config);
    this.backendErrorMessage = null;
  }

  startNew(): void {
    this.selectedConfig.set(null);
    this.isCreating.set(true);
    this.rebuildForm();
    this.backendErrorMessage = null;
  }

  cancel(): void {
    this.selectedConfig.set(null);
    this.isCreating.set(false);
    this.rebuildForm();
    this.backendErrorMessage = null;
  }

  private populateForm(config: PythonCodeToolConfig): void {
    this.rebuildForm();
    this.configForm.patchValue({ name: config.name });
    for (const field of this.toolFields()) {
      const value = config.configuration[field.name] ?? this.getDefaultValue(field.data_type);
      this.configForm.patchValue({ [field.name]: value });
    }
  }

  save(): void {
    if (this.configForm.invalid) {
      this.configForm.markAllAsTouched();
      this.toastService.error('Please fill in all required fields');
      return;
    }

    this.isSaving.set(true);
    this.backendErrorMessage = null;

    const formValue = this.configForm.value;
    const configuration: Record<string, any> = {};
    for (const field of this.toolFields()) {
      configuration[field.name] = formValue[field.name];
    }

    const payload: CreatePythonCodeToolConfigRequest = {
      name: formValue.name,
      tool: this.toolId(),
      configuration,
    };

    const selected = this.selectedConfig();
    if (selected) {
      this.configService.updateConfig(selected.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            const current = this.configs();
            const idx = current.findIndex(c => c.id === updated.id);
            if (idx !== -1) {
              const newList = [...current];
              newList[idx] = updated;
              this.configs.set(newList);
              this.configsChanged.emit(newList);
            }
            this.selectedConfig.set(updated);
            this.toastService.success(`Config "${updated.name}" updated`);
            this.isSaving.set(false);
          },
          error: (err) => {
            this.handleError(err);
            this.isSaving.set(false);
          },
        });
    } else {
      this.configService.createConfig(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            const newList = [created, ...this.configs()];
            this.configs.set(newList);
            this.configsChanged.emit(newList);
            this.selectedConfig.set(created);
            this.isCreating.set(false);
            this.toastService.success(`Config "${created.name}" created`);
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
    const config = this.selectedConfig();
    if (!config || !confirm(`Delete config "${config.name}"?`)) return;

    this.configService.deleteConfig(config.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const newList = this.configs().filter(c => c.id !== config.id);
          this.configs.set(newList);
          this.configsChanged.emit(newList);
          this.selectedConfig.set(null);
          this.isCreating.set(false);
          this.toastService.success(`Config "${config.name}" deleted`);
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
    const ctrl = this.configForm.get(fieldName);
    if (ctrl?.invalid && (ctrl?.dirty || ctrl?.touched)) {
      if (ctrl.errors?.['required']) return 'Required';
      if (ctrl.errors?.['maxlength']) return `Max ${ctrl.errors['maxlength'].requiredLength} chars`;
    }
    return null;
  }

  isSelectField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'llm_config' || dataType === 'embedding_config';
  }

  isBooleanField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'boolean';
  }

  isTextField(field: PythonCodeToolConfigField): boolean {
    return field.data_type === 'string' && !field.secret;
  }

  isJsonField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'any';
  }

  isNumberField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'integer' || dataType === 'float';
  }

  getFieldTypeLabel(dataType: string): string {
    return FIELD_TYPES.find(t => t.value === dataType)?.label || dataType;
  }

  getPlaceholder(field: PythonCodeToolConfigField): string {
    switch (field.data_type) {
      case 'string': return field.secret ? '••••••••' : 'Enter text...';
      case 'integer': return 'Enter whole number...';
      case 'float': return 'Enter decimal number...';
      case 'any': return 'Enter JSON value...';
      default: return '';
    }
  }

  getSelectOptions(field: PythonCodeToolConfigField): TcfSelectOption[] {
    return field.data_type === 'llm_config' ? this.llmConfigOptions() : this.embeddingConfigOptions();
  }
}

