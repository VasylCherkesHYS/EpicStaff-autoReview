import { Dialog } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    ButtonComponent,
    CustomInputComponent,
    JsonEditorComponent,
    SelectComponent,
} from '@shared/components';
import { MATERIAL_FORMS } from '@shared/material-forms';
import { startWith } from 'rxjs';
import { tap } from 'rxjs/operators';

import {
    DisplayedTelegramField,
    TelegramTriggerNodeField,
} from '../../../../pages/flows-page/components/flow-visual-programming/models/telegram-trigger.model';
import { WebhookStatus } from '../../../../pages/flows-page/components/flow-visual-programming/models/webhook.model';
import { AppSvgIconComponent } from '../../../../shared/components/app-svg-icon/app-svg-icon.component';
import { HelpTooltipComponent } from '../../../../shared/components/help-tooltip/help-tooltip.component';
import { TELEGRAM_TRIGGER_FIELDS } from '../../../core/constants/telegram-trigger-fields';
import { TelegramTriggerNodeModel } from '../../../core/models/node.model';
import { BaseSidePanel } from '../../../core/models/node-panel.abstract';
import {
    WebhookProviderType,
    WebhookTriggerModel,
} from '../../../core/models/webhook-trigger.model';
import { TelegramTriggerEditingDialogComponent } from '../../telegram-trigger-editing-dialog/telegram-trigger-editing-dialog.component';
import {
    WEBHOOK_NAME_PATTERN,
    WEBHOOK_PROVIDER_ITEMS,
    WEBHOOK_REGION_ITEMS,
} from '../webhook-trigger-node-panel/webhook-trigger-node-panel.component';

@Component({
    selector: 'app-telegram-trigger-node-panel',
    templateUrl: './telegram-trigger-node-panel.component.html',
    styleUrls: ['./telegram-trigger-node-panel.component.scss'],
    imports: [
        CustomInputComponent,
        ReactiveFormsModule,
        ButtonComponent,
        HelpTooltipComponent,
        AppSvgIconComponent,
        MATERIAL_FORMS,
        JsonEditorComponent,
        SelectComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TelegramTriggerNodePanelComponent
    extends BaseSidePanel<TelegramTriggerNodeModel>
    implements OnInit
{
    public override readonly isExpanded = input<boolean>(false);

    private dialog = inject(Dialog);

    selectedFields = signal<DisplayedTelegramField[]>([]);
    webhookPath = signal<string | null>(null);
    providerType = signal<WebhookProviderType | null>(null);

    readonly providerItems = WEBHOOK_PROVIDER_ITEMS;
    readonly regionItems = WEBHOOK_REGION_ITEMS;

    webhookStatusDisplay = computed<WebhookStatus>(() => {
        const provider = this.providerType();
        const path = this.webhookPath();
        if (!provider || !path) return WebhookStatus.FAIL;
        return WebhookStatus.SUCCESS;
    });

    jsonValues = computed(() => {
        const checkedItemsObj = this.selectedFields().reduce<Record<string, unknown>>((acc, field) => {
            acc[field.field_name] = field.model;
            return acc;
        }, {});

        return JSON.stringify(checkedItemsObj, null, 2);
    });

    editorOptions: Record<string, unknown> = {
        lineNumbers: 'off',
        theme: 'vs-dark',
        language: 'json',
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        wrappingIndent: 'indent',
        wordWrapBreakAfterCharacters: ',',
        wordWrapBreakBeforeCharacters: '}]',
        tabSize: 2,
        readOnly: true,
    };

    constructor() {
        super();
    }

    ngOnInit() {
        this.providerType.set(this.node().data.webhook_trigger?.provider_type ?? null);
    }

    private setSelectedFields(nodeFields: TelegramTriggerNodeField[]): void {
        const selectedFields = nodeFields.map((nodeField: TelegramTriggerNodeField) => {
            const parentFields = TELEGRAM_TRIGGER_FIELDS[nodeField.parent];
            const fieldWithModel = parentFields.find((f) => f.field_name === nodeField.field_name)!;

            return {
                ...fieldWithModel,
                parent: nodeField.parent,
                variable_path: nodeField.variable_path,
            };
        });

        this.selectedFields.set(selectedFields);
    }

    initializeForm(): FormGroup {
        this.setSelectedFields(this.node().data.fields);
        const trigger = this.node().data.webhook_trigger;
        const form = this.fb.group({
            node_name: [this.node().node_name, this.createNodeNameValidators()],
            telegram_bot_api_key: [this.node().data.telegram_bot_api_key || '', Validators.required],
            webhook_trigger_path: [
                trigger?.path || null,
                [Validators.required, Validators.pattern(WEBHOOK_NAME_PATTERN)],
            ],
            provider_type: [trigger?.provider_type ?? null],
            ngrok_name: [trigger?.ngrok_config?.name ?? ''],
            ngrok_auth_token: [trigger?.ngrok_config?.auth_token ?? ''],
            ngrok_domain: [trigger?.ngrok_config?.domain ?? ''],
            ngrok_region: [trigger?.ngrok_config?.region ?? 'eu'],
            localhost_name: [trigger?.localhost_config?.name ?? ''],
            localhost_domain: [trigger?.localhost_config?.domain ?? ''],
            fields: [this.node().data.fields || []],
        });
        form.get('webhook_trigger_path')
            ?.valueChanges.pipe(
                startWith(form.get('webhook_trigger_path')?.value ?? ''),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((value: string | null) => {
                this.webhookPath.set(value);
            });
        form.get('provider_type')
            ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((value: WebhookProviderType | null) => this.providerType.set(value));

        return form;
    }

    createUpdatedNode(): TelegramTriggerNodeModel {
        return {
            ...this.node(),
            node_name: this.form.value.node_name,

            data: {
                ...this.node().data,
                telegram_bot_api_key: this.form.value.telegram_bot_api_key,
                webhook_trigger: this.buildWebhookTrigger(),
                fields: this.form.value.fields,
            },
        };
    }

    private buildWebhookTrigger(): WebhookTriggerModel | null {
        const v = this.form.value;
        const path = (v.webhook_trigger_path ?? '').trim();
        if (!path) {
            return null;
        }
        const provider = (v.provider_type as WebhookProviderType | null) ?? null;
        const existingId = this.node().data.webhook_trigger?.id;
        return {
            ...(existingId ? { id: existingId } : {}),
            path,
            provider_type: provider,
            ngrok_config:
                provider === 'ngrok'
                    ? {
                          name: v.ngrok_name,
                          auth_token: v.ngrok_auth_token,
                          domain: v.ngrok_domain || null,
                          region: v.ngrok_region || 'eu',
                      }
                    : null,
            localhost_config:
                provider === 'localhost'
                    ? {
                          name: v.localhost_name,
                          domain: v.localhost_domain || null,
                      }
                    : null,
        };
    }

    getTelegramKeyErrorMessage(): string {
        const control = this.form?.get('telegram_bot_api_key');
        if (!control || control.valid || !control.errors) {
            return '';
        }
        if (control.errors['required']) {
            return 'This field is required';
        }
        return '';
    }

    onEditing(): void {
        this.form.value.fields;
        const dialog = this.dialog.open(TelegramTriggerEditingDialogComponent, {
            width: 'calc(100vw - 2rem)',
            height: 'calc(100vh - 2rem)',
            autoFocus: true,
            disableClose: true,
            data: this.selectedFields(),
        });

        dialog.closed
            .pipe(
                tap((selectedFields) => {
                    if (!selectedFields) return;

                    const fields = selectedFields as TelegramTriggerNodeField[];
                    this.setSelectedFields(fields);
                    this.updateFieldsControl(fields);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe();
    }

    private updateFieldsControl(items: TelegramTriggerNodeField[]) {
        const control = this.form.get('fields');
        control?.setValue(items);
    }

    onProviderTypeChanged(value: unknown): void {
        this.providerType.set((value as WebhookProviderType | null) ?? null);
    }

    get activeColor(): string {
        return this.node().color || '#685fff';
    }

    protected readonly WebhookStatus = WebhookStatus;
}
