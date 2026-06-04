import { Clipboard, ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CustomInputComponent, SelectComponent, SelectItem } from '@shared/components';
import { startWith } from 'rxjs';

import { CodeEditorComponent } from '../../../../user-settings-page/tools/custom-tool-editor/code-editor/code-editor.component';
import { WebhookTriggerNodeModel } from '../../../core/models/node.model';
import { BaseSidePanel } from '../../../core/models/node-panel.abstract';
import {
    WebhookProviderType,
    WebhookTriggerModel,
} from '../../../core/models/webhook-trigger.model';

export const WEBHOOK_NAME_PATTERN = /^[A-Za-z0-9\-._~/]*$/;

export const WEBHOOK_PROVIDER_ITEMS: SelectItem[] = [
    { name: '— None —', value: null },
    { name: 'Ngrok', value: 'ngrok' },
    { name: 'Localhost', value: 'localhost' },
];

export const WEBHOOK_REGION_ITEMS: SelectItem[] = [
    { name: 'Europe (eu)', value: 'eu' },
    { name: 'United States (us)', value: 'us' },
    { name: 'Asia/Pacific (ap)', value: 'ap' },
];

@Component({
    standalone: true,
    selector: 'app-webhook-trigger-node-panel',
    imports: [
        ReactiveFormsModule,
        CustomInputComponent,
        CodeEditorComponent,
        CommonModule,
        ClipboardModule,
        SelectComponent,
    ],
    templateUrl: 'webhook-trigger-node-panel.component.html',
    styleUrls: ['webhook-trigger-node-panel.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebhookTriggerNodePanelComponent extends BaseSidePanel<WebhookTriggerNodeModel> implements OnInit {
    private readonly clipboard = inject(Clipboard);

    public override readonly isExpanded = input<boolean>(false);

    public readonly isCodeEditorFullWidth = signal<boolean>(true);
    webhookPath = signal<string | null>(null);
    providerType = signal<WebhookProviderType | null>(null);

    readonly providerItems = WEBHOOK_PROVIDER_ITEMS;
    readonly regionItems = WEBHOOK_REGION_ITEMS;

    pythonCode: string = '';
    initialPythonCode: string = '';
    codeEditorHasError: boolean = false;

    liveUrl = computed<string | null>(() => this.node().data.webhook_trigger?.live_url ?? null);

    constructor() {
        super();
    }

    ngOnInit() {
        this.providerType.set(this.node().data.webhook_trigger?.provider_type ?? null);
    }

    get activeColor(): string {
        return this.node().color || '#685fff';
    }

    onPythonCodeChange(code: string): void {
        this.pythonCode = code;
        this.notifyExternalChange();
    }

    onCodeErrorChange(hasError: boolean): void {
        this.codeEditorHasError = hasError;
    }

    onProviderTypeChanged(value: unknown): void {
        this.providerType.set((value as WebhookProviderType | null) ?? null);
    }

    initializeForm(): FormGroup {
        const trigger = this.node().data.webhook_trigger;
        const form = this.fb.group({
            node_name: [this.node().node_name, this.createNodeNameValidators()],
            libraries: [this.node().data.python_code.libraries?.join(', ') || ''],
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
        this.pythonCode = this.node().data.python_code.code || '';
        this.initialPythonCode = this.pythonCode;
        return form;
    }

    createUpdatedNode(): WebhookTriggerNodeModel {
        const librariesArray = this.form.value.libraries
            ? this.form.value.libraries
                  .split(',')
                  .map((lib: string) => lib.trim())
                  .filter((lib: string) => lib.length > 0)
            : [];

        const webhook_trigger = this.buildWebhookTrigger();

        return {
            ...this.node(),
            node_name: this.form.value.node_name,
            input_map: {},
            output_variable_path: null,
            data: {
                ...this.node().data,
                webhook_trigger,
                python_code: {
                    name: this.node().data.python_code.name || 'Python Code',
                    code: this.pythonCode,
                    entrypoint: 'main',
                    libraries: librariesArray,
                },
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

    getWebhookNameErrorMessage(): string {
        const control = this.form?.get('webhook_trigger_path');
        if (!control || control.valid || !control.errors) {
            return '';
        }
        if (control.errors['pattern']) {
            return 'Use only letters, numbers, "-", "_", ".", "~", or "/"';
        }
        return '';
    }

    copyWebhookUrl(): void {
        const url = this.liveUrl();
        if (!url) return;

        this.clipboard.copy(url);
    }

    toggleCodeEditorFullWidth(): void {
        this.isCodeEditorFullWidth.update((value) => !value);
    }
}
