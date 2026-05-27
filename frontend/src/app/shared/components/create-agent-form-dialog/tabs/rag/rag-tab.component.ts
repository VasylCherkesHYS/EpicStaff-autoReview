import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    AppSvgIconComponent,
    ButtonComponent,
    DualSliderComponent,
    InputNumberComponent,
    RadioButtonComponent,
    SelectComponent,
    SelectItem,
    SliderWithStepperComponent,
    TextareaComponent,
    ToggleSwitchComponent,
    ValidationErrorsComponent,
} from '@shared/components';

import {
    GetCollectionRagsResponse,
    GetCollectionRequest,
} from '../../../../../features/knowledge-sources/models/collection.model';
import { AgentRag } from '../../../../../features/staff/models/agent.model';
import { AgentsService } from '../../../../../features/staff/services/staff.service';
import {
    AgentSearchConfigs,
    GraphBasicSearchConfig,
    GraphDriftSearchConfig,
    GraphGlobalSearchConfig,
    GraphLocalSearchConfig,
    GraphSearchMethod,
    SuggestResponse,
} from '../../../../models';
import { LlmConfigStorageService } from '../../../../services/llms/llm-config-storage.service';

export const GRAPH_BASIC_DEFAULTS: GraphBasicSearchConfig = {
    prompt: null,
    k: 10,
    max_context_tokens: 12000,
};

export const GRAPH_LOCAL_DEFAULTS: GraphLocalSearchConfig = {
    prompt: null,
    text_unit_prop: 0.5,
    community_prop: 0.15,
    conversation_history_max_turns: 5,
    max_context_tokens: 12000,
    top_k_entities: 10,
    top_k_relationships: 10,
};

export const GRAPH_GLOBAL_DEFAULTS: GraphGlobalSearchConfig = {
    map_prompt: null,
    reduce_prompt: null,
    knowledge_prompt: null,
    max_context_tokens: 12000,
    data_max_tokens: 12000,
    map_max_length: 1000,
    reduce_max_length: 2000,
    dynamic_community_selection: false,
    dynamic_search_threshold: 1,
    dynamic_search_keep_parent: false,
    dynamic_search_num_repeats: 1,
    dynamic_search_use_summary: false,
    dynamic_search_max_level: 2,
};

export const GRAPH_DRIFT_DEFAULTS: GraphDriftSearchConfig = {
    prompt: null,
    reduce_prompt: null,
    data_max_tokens: 12000,
    reduce_max_tokens: null,
    reduce_max_completion_tokens: null,
    reduce_temperature: 0.0,
    concurrency: 32,
    drift_k_followups: 20,
    primer_folds: 5,
    primer_llm_max_tokens: 12000,
    n_depth: 3,
    local_search_text_unit_prop: 0.9,
    local_search_community_prop: 0.1,
    local_search_top_k_mapped_entities: 10,
    local_search_top_k_relationships: 10,
    local_search_max_data_tokens: 12000,
    local_search_temperature: 0.0,
    local_search_top_p: 1.0,
    local_search_n: 1,
    local_search_llm_max_gen_tokens: null,
    local_search_llm_max_gen_completion_tokens: null,
};

@Component({
    selector: 'app-rag-tab',
    templateUrl: './rag-tab.component.html',
    styleUrls: ['../tab.component.scss'],
    imports: [
        ReactiveFormsModule,
        NgTemplateOutlet,
        SelectComponent,
        SliderWithStepperComponent,
        RadioButtonComponent,
        InputNumberComponent,
        DualSliderComponent,
        TextareaComponent,
        ValidationErrorsComponent,
        ButtonComponent,
        ToggleSwitchComponent,
        AppSvgIconComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RagTabComponent implements OnInit {
    private fb = inject(FormBuilder);
    private destroyRef = inject(DestroyRef);
    private agentsService = inject(AgentsService);
    private llmConfigStorage = inject(LlmConfigStorageService);

    form = input.required<FormGroup>();
    allKnowledgeSources = input.required<GetCollectionRequest[]>();
    agentRags = input.required<GetCollectionRagsResponse[]>();
    searchConfigs = input.required<AgentSearchConfigs | null>();
    loadingKnowledgeSources = input<boolean>(false);
    loadingRags = input<boolean>(false);
    llmConfigId = input<number | null>(null);

    selectedRagType = signal<'naive' | 'graph' | null>(null);
    suggesting = signal<boolean>(false);
    suggestMessage = signal<string | null>(null);
    suggestError = signal<string | null>(null);
    recommendedMethod = signal<GraphSearchMethod | null>(null);
    firstAvailableLlmId = signal<number | null>(null);

    resolvedLlmId = computed<number | null>(() => this.llmConfigId() ?? this.firstAvailableLlmId());

    knowledgeSelectItems = computed<SelectItem[]>(() => {
        return [
            {
                name: 'No collection',
                value: null,
            },
            ...this.allKnowledgeSources().map((item) => ({
                name: item.collection_name,
                value: item.collection_id,
            })),
        ];
    });
    agentRagSelectItems = computed<SelectItem<AgentRag>[]>(() => {
        return this.agentRags().map((item) => ({
            name: item.rag_type,
            value: {
                rag_id: item.rag_id,
                rag_type: item.rag_type,
            },
        }));
    });

    searchConfigsFormGroup: FormGroup | null = null;
    searchTypes: SelectItem[] = [
        { name: 'Basic', value: 'basic' },
        { name: 'Local', value: 'local' },
        { name: 'Global', value: 'global_search' },
        { name: 'DRIFT', value: 'drift_search' },
    ];

    textUnitProportionControl!: FormControl;
    communityProportionControl!: FormControl;
    driftLocalTextUnitPropControl!: FormControl;
    driftLocalCommunityPropControl!: FormControl;

    ngOnInit() {
        const ragControl = this.form().get('rag');
        const ragControlValue = ragControl?.value;

        if (ragControlValue) {
            this.selectedRagType.set(ragControlValue.rag_type);
            this.initSearchConfigsFormGroup(ragControlValue.rag_type);
        }

        ragControl?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((rag) => {
            this.clearSuggestFeedback();
            if (!rag) {
                this.searchConfigsFormGroup = null;
                return;
            }
            this.selectedRagType.set(rag.rag_type);
            this.initSearchConfigsFormGroup(rag.rag_type);
        });

        this.llmConfigStorage
            .getAllConfigs()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((configs) => {
                this.firstAvailableLlmId.set(configs?.[0]?.id ?? null);
            });
    }

    private initSearchConfigsFormGroup(ragType: string): void {
        const configs = this.searchConfigs();
        if (ragType === 'naive') {
            this.searchConfigsFormGroup = this.fb.group({
                search_limit: [configs?.naive?.search_limit ?? 3, [Validators.min(1), Validators.max(1000)]],
                similarity_threshold: [
                    configs?.naive?.similarity_threshold ?? 0.2,
                    [Validators.min(0.0), Validators.max(1.0)],
                ],
            });
        }

        if (ragType === 'graph') {
            this.searchConfigsFormGroup = this.fb.group({
                search_method: [configs?.graph?.search_method ?? 'basic', [Validators.required]],
                basic: this.initGraphBasicSearchConfig(configs?.graph?.basic),
                local: this.initGraphLocalSearchConfig(configs?.graph?.local),
                global_search: this.initGraphGlobalSearchConfig(configs?.graph?.global_search),
                drift_search: this.initGraphDriftSearchConfig(configs?.graph?.drift_search),
            });

            this.wireDynamicCommunityToggle();
        }

        this.form().setControl('search_configs', this.searchConfigsFormGroup);
    }

    private initGraphBasicSearchConfig(configs: GraphBasicSearchConfig | undefined): FormGroup {
        return this.fb.group({
            prompt: [configs?.prompt ?? GRAPH_BASIC_DEFAULTS.prompt, [Validators.maxLength(1000)]],
            k: [configs?.k ?? GRAPH_BASIC_DEFAULTS.k, [Validators.required, Validators.min(1), Validators.max(100)]],
            max_context_tokens: [
                configs?.max_context_tokens ?? GRAPH_BASIC_DEFAULTS.max_context_tokens,
                [Validators.required, Validators.min(100), Validators.max(100000)],
            ],
        });
    }

    private initGraphLocalSearchConfig(configs: GraphLocalSearchConfig | undefined): FormGroup {
        this.textUnitProportionControl = this.fb.control(
            configs?.text_unit_prop ?? GRAPH_LOCAL_DEFAULTS.text_unit_prop,
            [Validators.required, Validators.min(0), Validators.max(1)]
        );

        this.communityProportionControl = this.fb.control(
            configs?.community_prop ?? GRAPH_LOCAL_DEFAULTS.community_prop,
            [Validators.required, Validators.min(0), Validators.max(1)]
        );

        return this.fb.group({
            prompt: [configs?.prompt ?? GRAPH_LOCAL_DEFAULTS.prompt, [Validators.maxLength(1000)]],
            text_unit_prop: this.textUnitProportionControl,
            community_prop: this.communityProportionControl,
            conversation_history_max_turns: [
                configs?.conversation_history_max_turns ?? GRAPH_LOCAL_DEFAULTS.conversation_history_max_turns,
                [Validators.required, Validators.min(1), Validators.max(50)],
            ],
            max_context_tokens: [
                configs?.max_context_tokens ?? GRAPH_LOCAL_DEFAULTS.max_context_tokens,
                [Validators.required, Validators.min(100), Validators.max(100000)],
            ],
            top_k_entities: [
                configs?.top_k_entities ?? GRAPH_LOCAL_DEFAULTS.top_k_entities,
                [Validators.required, Validators.min(1), Validators.max(100)],
            ],
            top_k_relationships: [
                configs?.top_k_relationships ?? GRAPH_LOCAL_DEFAULTS.top_k_relationships,
                [Validators.required, Validators.min(1), Validators.max(100)],
            ],
        });
    }

    private initGraphGlobalSearchConfig(configs: GraphGlobalSearchConfig | undefined): FormGroup {
        return this.fb.group({
            map_prompt: [configs?.map_prompt ?? GRAPH_GLOBAL_DEFAULTS.map_prompt],
            reduce_prompt: [configs?.reduce_prompt ?? GRAPH_GLOBAL_DEFAULTS.reduce_prompt],
            knowledge_prompt: [configs?.knowledge_prompt ?? GRAPH_GLOBAL_DEFAULTS.knowledge_prompt],
            max_context_tokens: [
                configs?.max_context_tokens ?? GRAPH_GLOBAL_DEFAULTS.max_context_tokens,
                [Validators.required, Validators.min(100), Validators.max(100000)],
            ],
            data_max_tokens: [
                configs?.data_max_tokens ?? GRAPH_GLOBAL_DEFAULTS.data_max_tokens,
                [Validators.required, Validators.min(100), Validators.max(100000)],
            ],
            map_max_length: [
                configs?.map_max_length ?? GRAPH_GLOBAL_DEFAULTS.map_max_length,
                [Validators.required, Validators.min(1), Validators.max(10000)],
            ],
            reduce_max_length: [
                configs?.reduce_max_length ?? GRAPH_GLOBAL_DEFAULTS.reduce_max_length,
                [Validators.required, Validators.min(1), Validators.max(10000)],
            ],
            dynamic_community_selection: [
                configs?.dynamic_community_selection ?? GRAPH_GLOBAL_DEFAULTS.dynamic_community_selection,
            ],
            dynamic_search_threshold: [
                configs?.dynamic_search_threshold ?? GRAPH_GLOBAL_DEFAULTS.dynamic_search_threshold,
                [Validators.required, Validators.min(1), Validators.max(10)],
            ],
            dynamic_search_keep_parent: [
                configs?.dynamic_search_keep_parent ?? GRAPH_GLOBAL_DEFAULTS.dynamic_search_keep_parent,
            ],
            dynamic_search_num_repeats: [
                configs?.dynamic_search_num_repeats ?? GRAPH_GLOBAL_DEFAULTS.dynamic_search_num_repeats,
                [Validators.required, Validators.min(1), Validators.max(5)],
            ],
            dynamic_search_use_summary: [
                configs?.dynamic_search_use_summary ?? GRAPH_GLOBAL_DEFAULTS.dynamic_search_use_summary,
            ],
            dynamic_search_max_level: [
                configs?.dynamic_search_max_level ?? GRAPH_GLOBAL_DEFAULTS.dynamic_search_max_level,
                [Validators.required, Validators.min(1), Validators.max(5)],
            ],
        });
    }

    private initGraphDriftSearchConfig(configs: GraphDriftSearchConfig | undefined): FormGroup {
        this.driftLocalTextUnitPropControl = this.fb.control(
            configs?.local_search_text_unit_prop ?? GRAPH_DRIFT_DEFAULTS.local_search_text_unit_prop,
            [Validators.required, Validators.min(0), Validators.max(1)]
        );
        this.driftLocalCommunityPropControl = this.fb.control(
            configs?.local_search_community_prop ?? GRAPH_DRIFT_DEFAULTS.local_search_community_prop,
            [Validators.required, Validators.min(0), Validators.max(1)]
        );

        return this.fb.group({
            prompt: [configs?.prompt ?? GRAPH_DRIFT_DEFAULTS.prompt],
            reduce_prompt: [configs?.reduce_prompt ?? GRAPH_DRIFT_DEFAULTS.reduce_prompt],
            data_max_tokens: [
                configs?.data_max_tokens ?? GRAPH_DRIFT_DEFAULTS.data_max_tokens,
                [Validators.required, Validators.min(100), Validators.max(100000)],
            ],
            reduce_max_tokens: [configs?.reduce_max_tokens ?? GRAPH_DRIFT_DEFAULTS.reduce_max_tokens],
            reduce_max_completion_tokens: [
                configs?.reduce_max_completion_tokens ?? GRAPH_DRIFT_DEFAULTS.reduce_max_completion_tokens,
            ],
            reduce_temperature: [
                configs?.reduce_temperature ?? GRAPH_DRIFT_DEFAULTS.reduce_temperature,
                [Validators.required, Validators.min(0), Validators.max(2)],
            ],
            concurrency: [
                configs?.concurrency ?? GRAPH_DRIFT_DEFAULTS.concurrency,
                [Validators.required, Validators.min(1), Validators.max(256)],
            ],
            drift_k_followups: [
                configs?.drift_k_followups ?? GRAPH_DRIFT_DEFAULTS.drift_k_followups,
                [Validators.required, Validators.min(1), Validators.max(100)],
            ],
            primer_folds: [
                configs?.primer_folds ?? GRAPH_DRIFT_DEFAULTS.primer_folds,
                [Validators.required, Validators.min(1), Validators.max(50)],
            ],
            primer_llm_max_tokens: [
                configs?.primer_llm_max_tokens ?? GRAPH_DRIFT_DEFAULTS.primer_llm_max_tokens,
                [Validators.required, Validators.min(100), Validators.max(100000)],
            ],
            n_depth: [
                configs?.n_depth ?? GRAPH_DRIFT_DEFAULTS.n_depth,
                [Validators.required, Validators.min(1), Validators.max(10)],
            ],
            local_search_text_unit_prop: this.driftLocalTextUnitPropControl,
            local_search_community_prop: this.driftLocalCommunityPropControl,
            local_search_top_k_mapped_entities: [
                configs?.local_search_top_k_mapped_entities ?? GRAPH_DRIFT_DEFAULTS.local_search_top_k_mapped_entities,
                [Validators.required, Validators.min(1), Validators.max(100)],
            ],
            local_search_top_k_relationships: [
                configs?.local_search_top_k_relationships ?? GRAPH_DRIFT_DEFAULTS.local_search_top_k_relationships,
                [Validators.required, Validators.min(1), Validators.max(100)],
            ],
            local_search_max_data_tokens: [
                configs?.local_search_max_data_tokens ?? GRAPH_DRIFT_DEFAULTS.local_search_max_data_tokens,
                [Validators.required, Validators.min(100), Validators.max(100000)],
            ],
            local_search_temperature: [
                configs?.local_search_temperature ?? GRAPH_DRIFT_DEFAULTS.local_search_temperature,
                [Validators.required, Validators.min(0), Validators.max(2)],
            ],
            local_search_top_p: [
                configs?.local_search_top_p ?? GRAPH_DRIFT_DEFAULTS.local_search_top_p,
                [Validators.required, Validators.min(0), Validators.max(1)],
            ],
            local_search_n: [
                configs?.local_search_n ?? GRAPH_DRIFT_DEFAULTS.local_search_n,
                [Validators.required, Validators.min(1), Validators.max(10)],
            ],
            local_search_llm_max_gen_tokens: [
                configs?.local_search_llm_max_gen_tokens ?? GRAPH_DRIFT_DEFAULTS.local_search_llm_max_gen_tokens,
            ],
            local_search_llm_max_gen_completion_tokens: [
                configs?.local_search_llm_max_gen_completion_tokens ??
                    GRAPH_DRIFT_DEFAULTS.local_search_llm_max_gen_completion_tokens,
            ],
        });
    }

    private wireDynamicCommunityToggle(): void {
        const globalGroup = this.searchConfigsFormGroup?.get('global_search') as FormGroup | null;
        if (!globalGroup) return;
        const flag = globalGroup.get('dynamic_community_selection');
        if (!flag) return;

        const toggle = (enabled: boolean) => {
            const dependents = [
                'dynamic_search_threshold',
                'dynamic_search_keep_parent',
                'dynamic_search_num_repeats',
                'dynamic_search_use_summary',
                'dynamic_search_max_level',
            ];
            dependents.forEach((name) => {
                const ctrl = globalGroup.get(name);
                if (!ctrl) return;
                if (enabled) {
                    ctrl.enable({ emitEvent: false });
                } else {
                    ctrl.disable({ emitEvent: false });
                }
            });
        };

        toggle(!!flag.value);
        flag.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((v) => toggle(!!v));
    }

    onTextUnitPropUpdate(value: number): void {
        this.textUnitProportionControl.setValue(value);
    }

    onCommunityPropUpdate(value: number): void {
        this.communityProportionControl.setValue(value);
    }

    onDriftLocalTextUnitPropUpdate(value: number): void {
        this.driftLocalTextUnitPropControl.setValue(value);
    }

    onDriftLocalCommunityPropUpdate(value: number): void {
        this.driftLocalCommunityPropControl.setValue(value);
    }

    isKnowledgeControlInvalid(): boolean {
        return !!this.form().get('knowledge_collection')?.invalid;
    }

    isRagControlInvalid(): boolean {
        return !!this.form().get('rag')?.invalid;
    }

    get collectionId(): number | null {
        return this.form().get('knowledge_collection')?.value ?? null;
    }

    get activeGraphMethod(): GraphSearchMethod | null {
        return (this.searchConfigsFormGroup?.get('search_method')?.value as GraphSearchMethod) ?? null;
    }

    get canSuggest(): boolean {
        if (this.suggesting()) return false;
        if (this.collectionId == null) return false;
        if (this.resolvedLlmId() == null) return false;
        if (this.selectedRagType() === 'graph' && !this.activeGraphMethod) return false;
        return !!this.searchConfigsFormGroup;
    }

    suggestDisabledReason(): string {
        if (this.suggesting()) return 'Fetching suggestions…';
        if (this.collectionId == null) return 'Select a knowledge collection first';
        if (this.resolvedLlmId() == null) return 'No LLM configs exist yet. Create one first.';
        if (this.selectedRagType() === 'graph' && !this.activeGraphMethod) return 'Pick a graph search method first';
        return 'Compute recommended values for the selected collection and LLM';
    }

    onSuggestSettings(): void {
        if (!this.canSuggest || !this.searchConfigsFormGroup) return;

        const ragType = this.selectedRagType();
        const targetGroup =
            ragType === 'graph'
                ? (this.searchConfigsFormGroup.get(this.activeGraphMethod!) as FormGroup | null)
                : this.searchConfigsFormGroup;

        if (!targetGroup) return;

        if (targetGroup.dirty) {
            const ok = confirm('This will overwrite your changes. Continue?');
            if (!ok) return;
        }

        this.clearSuggestFeedback();
        this.suggesting.set(true);

        const collectionId = this.collectionId!;
        const llmConfigId = this.resolvedLlmId()!;

        const request$ =
            ragType === 'graph'
                ? this.agentsService.suggestGraphSearchParams({
                      knowledge_collection_id: collectionId,
                      llm_config_id: llmConfigId,
                      search_method: this.activeGraphMethod!,
                  })
                : this.agentsService.suggestNaiveSearchParams({
                      knowledge_collection_id: collectionId,
                      llm_config_id: llmConfigId,
                  });

        request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (response) => this.applySuggestion(targetGroup, response),
            error: (err) => {
                this.suggesting.set(false);
                const message = err?.error?.error ?? 'Failed to fetch suggested settings';
                this.suggestError.set(message);
            },
        });
    }

    private applySuggestion(target: FormGroup, response: SuggestResponse): void {
        target.patchValue(response.suggested_params);
        target.markAsPristine();

        if (response.recommended_search_method) {
            this.recommendedMethod.set(response.recommended_search_method);
        } else {
            this.recommendedMethod.set(null);
        }

        const clamped = response.clamped_fields?.length ?? 0;
        const warning = response.llm_resolution_warning;
        let msg = `Suggested values applied.`;
        if (clamped > 0) msg += ` ${clamped} field(s) auto-capped to fit context.`;
        if (warning) msg += ` (${warning})`;
        this.suggestMessage.set(msg);
        this.suggesting.set(false);
    }

    applyRecommendedMethod(): void {
        const recommended = this.recommendedMethod();
        if (!recommended || !this.searchConfigsFormGroup) return;
        this.searchConfigsFormGroup.get('search_method')?.setValue(recommended);
        this.recommendedMethod.set(null);
    }

    switchAndResuggest(): void {
        const recommended = this.recommendedMethod();
        if (!recommended || !this.searchConfigsFormGroup) return;
        this.searchConfigsFormGroup.get('search_method')?.setValue(recommended);
        this.recommendedMethod.set(null);
        this.onSuggestSettings();
    }

    dismissSuggestMessage(): void {
        this.suggestMessage.set(null);
    }

    dismissSuggestError(): void {
        this.suggestError.set(null);
    }

    private clearSuggestFeedback(): void {
        this.suggestMessage.set(null);
        this.suggestError.set(null);
        this.recommendedMethod.set(null);
    }
}
