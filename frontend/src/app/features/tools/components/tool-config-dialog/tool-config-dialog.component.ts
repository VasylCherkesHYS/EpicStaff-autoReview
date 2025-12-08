import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Inject,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { DialogRef, DIALOG_DATA, DialogModule } from '@angular/cdk/dialog';
import {
  ReactiveFormsModule,
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';

import {
  GetPythonCodeToolRequest,
  PythonCodeToolConfigField,
  ToolConfigFieldType,
} from '../../models/python-code-tool.model';
import {
  PythonCodeToolConfig,
  CreatePythonCodeToolConfigRequest,
} from '../../models/tool_config.model';
import { PythonCodeToolConfigService } from '../../services/custom-tools/python-code-tool-config.service';
import {
  PythonCodeToolConfigFieldService,
  CreateConfigFieldRequest,
} from '../../services/custom-tools/python-code-tool-config-field.service';
import { ToastService } from '../../../../services/notifications/toast.service';
import { FullLLMConfigService, FullLLMConfig } from '../../../../services/full-llm-config.service';
import { FullEmbeddingConfigService, FullEmbeddingConfig } from '../../../../services/full-embedding.service';

import {
  TcfInputComponent,
  TcfTextareaComponent,
  TcfSelectComponent,
  TcfSelectOption,
  TcfCheckboxComponent,
  TcfTabsComponent,
  TcfTab,
  TcfCodeEditorComponent,
} from './ui';

interface DialogData {
  tool: GetPythonCodeToolRequest;
}

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
  selector: 'app-tool-config-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    DialogModule,
    MatIconModule,
    TcfInputComponent,
    TcfTextareaComponent,
    TcfSelectComponent,
    TcfCheckboxComponent,
    TcfTabsComponent,
    TcfCodeEditorComponent,
  ],
  templateUrl: './tool-config-dialog.component.html',
  styleUrls: ['./tool-config-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToolConfigDialogComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(PythonCodeToolConfigService);
  private readonly fieldService = inject(PythonCodeToolConfigFieldService);
  private readonly toastService = inject(ToastService);
  private readonly llmConfigService = inject(FullLLMConfigService);
  private readonly embeddingConfigService = inject(FullEmbeddingConfigService);

  public readonly tool: GetPythonCodeToolRequest;
  public readonly fieldTypes = FIELD_TYPES;

  public readonly toolFields = signal<PythonCodeToolConfigField[]>([]);
  public readonly configs = signal<PythonCodeToolConfig[]>([]);
  public readonly selectedConfig = signal<PythonCodeToolConfig | null>(null);
  public readonly selectedField = signal<PythonCodeToolConfigField | null>(null);
  public readonly isLoading = signal(true);
  public readonly isSaving = signal(false);
  public readonly isCreatingNewConfig = signal(false);
  public readonly isCreatingNewField = signal(false);
  public readonly activeTabIndex = signal(0);

  public readonly llmConfigs = signal<FullLLMConfig[]>([]);
  public readonly embeddingConfigs = signal<FullEmbeddingConfig[]>([]);

  public configForm!: FormGroup;
  public fieldForm!: FormGroup;
  public backendErrorMessage: string | null = null;

  public readonly hasFields = computed(() => this.toolFields().length > 0);
  public readonly showConfigForm = computed(
    () => this.selectedConfig() !== null || this.isCreatingNewConfig()
  );
  public readonly showFieldForm = computed(
    () => this.selectedField() !== null || this.isCreatingNewField()
  );

  public readonly tabs = computed<TcfTab[]>(() => [
    { icon: 'settings', label: 'Configurations', badge: this.configs().length },
    { icon: 'view_list', label: 'Fields', badge: this.toolFields().length },
  ]);

  public readonly fieldTypeOptions = computed<TcfSelectOption[]>(() =>
    FIELD_TYPES.map(t => ({ value: t.value, label: t.label }))
  );

  public readonly llmConfigOptions = computed<TcfSelectOption[]>(() => [
    { value: null, label: '-- None --' },
    ...this.llmConfigs().map(llm => ({
      value: llm.id,
      label: `${llm.custom_name} · ${llm.modelDetails?.name || 'Unknown'}`,
    })),
  ]);

  public readonly embeddingConfigOptions = computed<TcfSelectOption[]>(() => [
    { value: null, label: '-- None --' },
    ...this.embeddingConfigs().map(emb => ({
      value: emb.id,
      label: `${emb.custom_name} · ${emb.modelDetails?.name || 'Unknown'}`,
    })),
  ]);

  constructor(
    private dialogRef: DialogRef<void>,
    @Inject(DIALOG_DATA) public data: DialogData
  ) {
    this.tool = data.tool;
  }

  ngOnInit(): void {
    this.loadData();
    this.initializeConfigForm();
    this.initializeFieldForm();
    this.setupFieldFormWatchers();
  }

  private loadData(): void {
    this.isLoading.set(true);

    forkJoin({
      configs: this.configService.getConfigs(this.tool.id),
      fields: this.fieldService.getFieldsByTool(this.tool.id),
      llmConfigs: this.llmConfigService.getFullLLMConfigs(),
      embeddingConfigs: this.embeddingConfigService.getFullEmbeddingConfigs(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ configs, fields, llmConfigs, embeddingConfigs }) => {
          this.configs.set(configs);
          this.toolFields.set(fields);
          this.llmConfigs.set(llmConfigs);
          this.embeddingConfigs.set(embeddingConfigs);
          this.isLoading.set(false);
          this.rebuildConfigForm();
        },
        error: (err) => {
          console.error('Error loading data:', err);
          this.toastService.error('Failed to load configurations');
          this.isLoading.set(false);
        },
      });
  }

  private initializeConfigForm(): void {
    this.configForm = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    });
  }

  private rebuildConfigForm(): void {
    const formControls: Record<string, FormControl> = {
      name: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    };

    for (const field of this.toolFields()) {
      const validators = this.getValidatorsForField(field);
      formControls[field.name] = new FormControl(
        this.getDefaultValue(field.data_type),
        validators
      );
    }

    this.configForm = new FormGroup(formControls);
  }

  private getValidatorsForField(field: PythonCodeToolConfigField): any[] {
    const validators: any[] = [];

    if (field.required) {
      validators.push(Validators.required);
    }

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
        if (field.required) {
          validators.push(Validators.min(1));
        }
        break;
    }

    return validators;
  }

  private initializeFieldForm(): void {
    this.fieldForm = new FormGroup({
      name: new FormControl('', [Validators.required, Validators.maxLength(255)]),
      description: new FormControl(''),
      data_type: new FormControl('string', [Validators.required]),
      required: new FormControl(false),
      secret: new FormControl(false),
    });
  }

  private clearConfigsState(): void {
    this.configs.set([]);
    this.selectedConfig.set(null);
    this.isCreatingNewConfig.set(false);
    this.rebuildConfigForm();
  }

  private confirmConfigDeletionIfNeeded(): boolean {
    if (this.configs().length === 0) return true;
    const shouldDelete = confirm(
      'Changing fields will delete all configurations for this tool. Continue?'
    );
    if (shouldDelete) {
      this.clearConfigsState();
    }
    return shouldDelete;
  }

  private setupFieldFormWatchers(): void {
    const dataTypeControl = this.fieldForm.get('data_type');
    dataTypeControl?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dataType: ToolConfigFieldType) => {
        if (dataType !== 'string') {
          this.fieldForm.get('secret')?.setValue(false, { emitEvent: false });
        }
      });
  }

  private getDefaultValue(dataType: ToolConfigFieldType): any {
    switch (dataType) {
      case 'boolean':
        return false;
      case 'integer':
      case 'float':
      case 'llm_config':
      case 'embedding_config':
        return null;
      case 'string':
      case 'any':
      default:
        return '';
    }
  }

  public selectConfig(config: PythonCodeToolConfig): void {
    this.isCreatingNewConfig.set(false);
    this.selectedConfig.set(config);
    this.populateConfigForm(config);
    this.backendErrorMessage = null;
  }

  public startNewConfig(): void {
    this.selectedConfig.set(null);
    this.isCreatingNewConfig.set(true);
    this.rebuildConfigForm();
    this.backendErrorMessage = null;
  }

  public cancelConfigEdit(): void {
    this.selectedConfig.set(null);
    this.isCreatingNewConfig.set(false);
    this.rebuildConfigForm();
    this.backendErrorMessage = null;
  }

  private populateConfigForm(config: PythonCodeToolConfig): void {
    this.rebuildConfigForm();
    this.configForm.patchValue({ name: config.name });
    for (const field of this.toolFields()) {
      const value = config.configuration[field.name] ?? this.getDefaultValue(field.data_type);
      this.configForm.patchValue({ [field.name]: value });
    }
  }

  public onSaveConfig(): void {
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
      tool: this.tool.id,
      configuration,
    };

    const selectedConfig = this.selectedConfig();
    if (selectedConfig) {
      this.configService
        .updateConfig(selectedConfig.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            const current = this.configs();
            const idx = current.findIndex((c) => c.id === updated.id);
            if (idx !== -1) {
              const newConfigs = [...current];
              newConfigs[idx] = updated;
              this.configs.set(newConfigs);
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
      this.configService
        .createConfig(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.configs.update((c) => [created, ...c]);
            this.selectedConfig.set(created);
            this.isCreatingNewConfig.set(false);
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

  public onDeleteConfig(): void {
    const config = this.selectedConfig();
    if (!config) return;
    if (!confirm(`Delete config "${config.name}"?`)) return;

    this.configService
      .deleteConfig(config.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.configs.update((c) => c.filter((x) => x.id !== config.id));
          this.selectedConfig.set(null);
          this.isCreatingNewConfig.set(false);
          this.toastService.success(`Config "${config.name}" deleted`);
        },
        error: (err) => this.handleError(err),
      });
  }

  public selectField(field: PythonCodeToolConfigField): void {
    this.isCreatingNewField.set(false);
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

  public startNewField(): void {
    this.selectedField.set(null);
    this.isCreatingNewField.set(true);
    this.fieldForm.reset({
      name: '',
      description: '',
      data_type: 'string',
      required: false,
      secret: false,
    });
    this.backendErrorMessage = null;
  }

  public cancelFieldEdit(): void {
    this.selectedField.set(null);
    this.isCreatingNewField.set(false);
    this.fieldForm.reset();
    this.backendErrorMessage = null;
  }

  public onSaveField(): void {
    if (this.fieldForm.invalid) {
      this.fieldForm.markAllAsTouched();
      this.toastService.error('Please fill in all required fields');
      return;
    }

    if (!this.confirmConfigDeletionIfNeeded()) {
      return;
    }

    this.isSaving.set(true);
    this.backendErrorMessage = null;

    const formValue = this.fieldForm.value;
    const payload: CreateConfigFieldRequest = {
      tool: this.tool.id,
      name: formValue.name,
      description: formValue.description || '',
      data_type: formValue.data_type,
      required: formValue.required || false,
      secret: formValue.data_type === 'string' ? !!formValue.secret : false,
    };

    const selectedField = this.selectedField();
    if (selectedField) {
      this.fieldService
        .updateField(selectedField.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            const current = this.toolFields();
            const idx = current.findIndex((f) => f.id === updated.id);
            if (idx !== -1) {
              const newFields = [...current];
              newFields[idx] = updated;
              this.toolFields.set(newFields);
            }
            this.selectedField.set(updated);
            this.rebuildConfigForm();
            this.toastService.success(`Field "${updated.name}" updated`);
            this.isSaving.set(false);
          },
          error: (err) => {
            this.handleError(err);
            this.isSaving.set(false);
          },
        });
    } else {
      this.fieldService
        .createField(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.toolFields.update((f) => [...f, created]);
            this.selectedField.set(created);
            this.isCreatingNewField.set(false);
            this.rebuildConfigForm();
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

  public onDeleteField(): void {
    const field = this.selectedField();
    if (!field) return;
    if (!this.confirmConfigDeletionIfNeeded()) return;
    if (!confirm(`Delete field "${field.name}"? This will affect existing configs.`)) return;

    this.fieldService
      .deleteField(field.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.toolFields.update((f) => f.filter((x) => x.id !== field.id));
          this.selectedField.set(null);
          this.isCreatingNewField.set(false);
          this.rebuildConfigForm();
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
      if (error.error.non_field_errors && Array.isArray(error.error.non_field_errors)) {
        return error.error.non_field_errors[0];
      }
    }
    if (error?.message) return error.message;
    return 'An unexpected error occurred';
  }

  public getConfigFieldError(fieldName: string): string | null {
    const field = this.configForm.get(fieldName);
    if (field?.invalid && (field?.dirty || field?.touched)) {
      if (field.errors?.['required']) return 'Required';
      if (field.errors?.['maxlength']) return `Max ${field.errors['maxlength'].requiredLength} chars`;
    }
    return null;
  }

  public getFieldFormError(fieldName: string): string | null {
    const field = this.fieldForm.get(fieldName);
    if (field?.invalid && (field?.dirty || field?.touched)) {
      if (field.errors?.['required']) return 'Required';
      if (field.errors?.['maxlength']) return `Max ${field.errors['maxlength'].requiredLength} chars`;
    }
    return null;
  }

  public isSelectField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'llm_config' || dataType === 'embedding_config';
  }

  public isBooleanField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'boolean';
  }

  public isSecretToggleVisible(): boolean {
    return this.fieldForm?.get('data_type')?.value === 'string';
  }

  public isTextField(field: PythonCodeToolConfigField): boolean {
    return field.data_type === 'string' && !field.secret;
  }

  public isJsonField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'any';
  }

  public isNumberField(dataType: ToolConfigFieldType): boolean {
    return dataType === 'integer' || dataType === 'float';
  }

  public getFieldTypeLabel(dataType: string): string {
    return FIELD_TYPES.find((t) => t.value === dataType)?.label || dataType;
  }

  public getPlaceholder(field: PythonCodeToolConfigField): string {
    switch (field.data_type) {
      case 'string': return field.secret ? '••••••••' : 'Enter text...';
      case 'integer': return 'Enter whole number...';
      case 'float': return 'Enter decimal number...';
      case 'any': return 'Enter JSON value...';
      default: return '';
    }
  }

  public getSelectOptions(field: PythonCodeToolConfigField): TcfSelectOption[] {
    if (field.data_type === 'llm_config') {
      return this.llmConfigOptions();
    }
    return this.embeddingConfigOptions();
  }

  public onClose(): void {
    this.dialogRef.close();
  }

  public onTabChange(index: number): void {
    this.activeTabIndex.set(index);
    this.backendErrorMessage = null;
  }
}
