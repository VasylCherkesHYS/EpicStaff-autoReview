import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import {
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import {
    GraphDto,
    CreateGraphDtoRequest,
} from '../../../../features/flows/models/graph.model';
import { FlowsStorageService } from '../../../../features/flows/services/flows-storage.service';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { ButtonComponent } from '../../../../shared/components/buttons/button/button.component';
import { InputNumberComponent } from '../../../../shared/components/app-input-number/input-number.component';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../../../../services/config/config.service';
import { Observable, of, forkJoin } from 'rxjs';
import { CreateStartNodeRequest } from '../../../../pages/flows-page/components/flow-visual-programming/models/start-node.model';
import { CreatePythonNodeRequest } from '../../../../pages/flows-page/components/flow-visual-programming/models/python-node.model';
import { CreateCodeAgentNodeRequest } from '../../../../pages/flows-page/components/flow-visual-programming/models/code-agent-node.model';
import { CreateDecisionTableNodeRequest } from '../../../../pages/flows-page/components/flow-visual-programming/models/decision-table-node.model';
import { CreateEdgeRequest } from '../../../../pages/flows-page/components/flow-visual-programming/models/edge.model';
import {
    SelectComponent,
    SelectItem,
} from '../../../../shared/components/select/select.component';

export interface RalphFlowDialogData {
    isEdit: boolean;
    flow?: GraphDto;
}

@Component({
    selector: 'app-create-ralph-flow-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        ButtonComponent,
        InputNumberComponent,
        SelectComponent,
    ],
    templateUrl: './create-ralph-flow-dialog.component.html',
    styleUrls: ['./create-ralph-flow-dialog.component.scss'],
})
export class CreateRalphFlowDialogComponent implements OnInit {
    flowForm: FormGroup;
    isEditMode = false;
    dialogTitle = 'Create Smart Flow';
    submitButtonText = 'Generate';
    originalFlow?: GraphDto;
    public selectedIcon: string | null = null;
    public isSubmitting = false;
    public errorMessage: string | null = null;
    public llmConfigs: any[] = [];

    public get llmConfigItems(): SelectItem[] {
        return this.llmConfigs.map((config: any) => ({
            name: config.custom_name || `LLM Config #${config.id}`,
            value: config.id,
            tip: `Model: ${config.model || 'Unknown'}, Temperature: ${config.temperature || 'N/A'}`,
        }));
    }

    constructor(
        public dialogRef: DialogRef<GraphDto | undefined>,
        @Inject(DIALOG_DATA) public data: RalphFlowDialogData,
        private flowsStorageService: FlowsStorageService,
        private http: HttpClient,
        private configService: ConfigService,
    ) {
        this.flowForm = new FormGroup({
            name: new FormControl('', [Validators.required]),
            description: new FormControl(''),
            flow_icon: new FormControl(''),
            maxIterations: new FormControl(5, [
                Validators.required,
                Validators.min(1),
            ]),
            acceptanceCriteria: new FormControl(''),
            workFolder: new FormControl('', [Validators.required]),
            llmConfig: new FormControl('', [Validators.required]),
        });

        if (data && data.isEdit && data.flow) {
            this.isEditMode = true;
            this.dialogTitle = 'Edit AI-Generated Flow';
            this.submitButtonText = 'Save';
            this.originalFlow = data.flow;
        }
    }

    ngOnInit(): void {
        // Load LLM configurations
        this.loadLLMConfigs();

        if (this.isEditMode && this.data.flow) {
            this.flowForm.patchValue({
                name: this.data.flow.name,
                description: this.data.flow.description || '',
                flow_icon: (this.data.flow.metadata as any)?.flow_icon || '',
                maxIterations:
                    (this.data.flow.metadata as any)?.maxIterations || '',
                acceptanceCriteria:
                    (this.data.flow.metadata as any)?.acceptanceCriteria || '',
                workFolder: (this.data.flow.metadata as any)?.workFolder || '',
                llmConfig: (this.data.flow.metadata as any)?.llmConfig || '',
            });
            this.selectedIcon =
                (this.data.flow.metadata as any)?.flow_icon || null;
        }
    }

    private loadLLMConfigs(): void {
        this.http.get(`${this.configService.apiUrl}llm-configs/`).subscribe({
            next: (response: any) => {
                this.llmConfigs = response.results || [];
            },
            error: (error) => {
                console.error('Error loading LLM configs:', error);
                this.errorMessage = 'Failed to load LLM configurations.';
            },
        });
    }

    onSubmit(): void {
        if (this.flowForm.invalid || this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;
        this.errorMessage = null;

        const formValue = this.flowForm.value;

        // Step 1: Create flow with empty metadata
        const newFlowMetadata: any = {
            flow_icon: formValue.flow_icon || undefined,
            nodes: [],
            connections: [],
            groups: [],
        };

        const createFlowRequest: CreateGraphDtoRequest = {
            name: formValue.name,
            description: formValue.description || undefined,
            metadata: newFlowMetadata,
        };

        this.flowsStorageService
            .createFlow(createFlowRequest)
            .pipe(
                switchMap((createdFlow: GraphDto) => {
                    // Step 2: Create all nodes sequentially
                    return this.createNodesSequentially(
                        createdFlow.id,
                        formValue,
                    ).pipe(
                        switchMap((nodeResults) => {
                            // Step 3: Create edges between nodes
                            return this.createEdgesSequentially(
                                createdFlow.id,
                                nodeResults,
                            ).pipe(
                                switchMap(() => {
                                    // Step 4: Update flow metadata with visual representation
                                    return this.updateFlowMetadata(
                                        createdFlow.id,
                                        nodeResults,
                                        formValue,
                                    );
                                }),
                            );
                        }),
                    );
                }),
                finalize(() => (this.isSubmitting = false)),
            )
            .subscribe({
                next: (updatedFlow: GraphDto) => {
                    // Step 5: Redirect to flow page
                    this.dialogRef.close(updatedFlow);
                },
                error: (error) => {
                    console.error('Error creating Ralph flow:', error);
                    this.errorMessage =
                        'Failed to create flow. Please try again.';
                },
            });
    }

    private createNodesSequentially(
        flowId: number,
        formValue: any,
    ): Observable<any> {
        const headers = { 'Content-Type': 'application/json' };
        const apiUrl = this.configService.apiUrl;

        // Prepare node creation requests
        const startNodeRequest: CreateStartNodeRequest = {
            graph: flowId,
            variables: {
                plan: null,
                status: null,
                $schema: 'start',
                iteration: 0,
                assignment: formValue.description || '',
                criteria: formValue.acceptanceCriteria || '',
                full_prompt: null,
                work_folder: formValue.workFolder || '',
                build_result: null,
                max_iterations: formValue.maxIterations || 5,
            },
        };

        const pythonNodeRequest: CreatePythonNodeRequest = {
            graph: flowId,
            node_name: 'Compose Promt',
            python_code: {
                libraries: [],
                code: 'def main(assignment="", work_folder=""):\n    """Compose the full prompt by prepending the work folder to the assignment."""\n    return f"Working folder: {work_folder}\\n\\n{assignment}"',
                entrypoint: 'main',
            },
            input_map: {
                assignment: 'variables.assignment',
                work_folder: 'variables.work_folder',
            },
            output_variable_path: 'variables.full_prompt',
        };

        const codeAgent1Request: CreateCodeAgentNodeRequest = {
            graph: flowId,
            node_name: 'Planning stage',
            llm_config: formValue.llmConfig.value || 6,
            agent_mode: 'build',
            session_id: `${flowId}_planning`,
            system_prompt:
                'You are a PLANNING agent in a RALPH loop. Your role is STRICTLY LIMITED to planning. You MUST read and follow ralph/planning_prompt.md. You are STRICTLY FORBIDDEN from implementing anything. You MUST NOT create files. You MUST NOT generate CSV, HTML, code, or any output files. You MUST ONLY create or update IMPLEMENTATION_PLAN.md. If you attempt implementation, you are violating your core instructions. Your task ends immediately after planning.',
            stream_handler_code:
                '# ── Code Agent Stream Handler ──────────────────────────────────\n# Define any of these functions to hook into the agent lifecycle.\n# Each receives a \'context\' dict containing all input_map fields\n# plus \'session_id\' and \'node_name\'.\n# Return a dict from any handler to persist state across calls\n# (e.g. store a message ID in on_stream_start, read it in on_complete).\n\n# def on_stream_start(context):\n#     """Called once before the prompt is sent to OpenCode."""\n#     pass\n\n# def on_chunk(text, context):\n#     """Called each time the agent\'s reasoning or tool output updates.\n#     \'text\' contains the accumulated thinking/tool-call text so far."""\n#     pass\n\n# def on_complete(full_reply, context):\n#     """Called when the agent finishes (or is stopped).\n#     \'full_reply\' contains the agent\'s final response text."""\n#     pass\n',
            libraries: [],
            polling_interval_ms: 1000,
            silence_indicator_s: 3,
            indicator_repeat_s: 5,
            chunk_timeout_s: 30,
            inactivity_timeout_s: 120,
            max_wait_s: 300,
            input_map: {
                prompt: 'variables.full_prompt',
            },
            output_variable_path: 'variables.plan_output',
        };

        const codeAgent2Request: CreateCodeAgentNodeRequest = {
            graph: flowId,
            node_name: 'Build Stage',
            llm_config: formValue.llmConfig.value || 6,
            agent_mode: 'build',
            session_id: `${flowId}_build`,
            system_prompt:
                'First Read your detailed instructions from ralph/build_prompt.md before starting. Dont implement anything before this! CRITICAL: ONE TASK PER ITERATION. Implement one task, run tests, mark it done, then stop.When ALL tasks in IMPLEMENTATION_PLAN.md are [x] AND tests pass, output exactly: <promise>COMPLETE</promise>Do NOT output the promise if any tasks remain unchecked.',
            stream_handler_code:
                '# ── Code Agent Stream Handler ──────────────────────────────────\n# Define any of these functions to hook into the agent lifecycle.\n# Each receives a \'context\' dict containing all input_map fields\n# plus \'session_id\' and \'node_name\'.\n# Return a dict from any handler to persist state across calls\n# (e.g. store a message ID in on_stream_start, read it in on_complete).\n\n# def on_stream_start(context):\n#     """Called once before the prompt is sent to OpenCode."""\n#     pass\n\n# def on_chunk(text, context):\n#     """Called each time the agent\'s reasoning or tool output updates.\n#     \'text\' contains the accumulated thinking/tool-call text so far."""\n#     pass\n\n# def on_complete(full_reply, context):\n#     """Called when the agent finishes (or is stopped).\n#     \'full_reply\' contains the agent\'s final response text."""\n#     pass\n',
            libraries: [],
            polling_interval_ms: 1000,
            silence_indicator_s: 3,
            indicator_repeat_s: 5,
            chunk_timeout_s: 30,
            inactivity_timeout_s: 120,
            max_wait_s: 300,
            input_map: {
                prompt: 'variables.full_prompt',
                planning: 'variables.plan_output',
            },
            output_variable_path: 'variables.build_output',
        };

        const decisionTableRequest: CreateDecisionTableNodeRequest = {
            graph: flowId,
            node_name: 'Decision-Table (#1)',
            condition_groups: [
                {
                    group_name: 'Complete',
                    group_type: 'complex',
                    expression:
                        '"<promise>COMPLETE</promise>" in str(variables.get("build_output", ""))',
                    conditions: [],
                    manipulation: null,
                    next_node: '__end__',
                    order: 1,
                },
                {
                    group_name: 'Max Iterations',
                    group_type: 'complex',
                    expression:
                        'variables.get("iteration", 0) >= variables.get("max_iterations", 5)',
                    conditions: [],
                    manipulation: null,
                    next_node: '__end__',
                    order: 2,
                },
                {
                    group_name: 'Continue',
                    group_type: 'complex',
                    expression: 'True',
                    conditions: [],
                    manipulation:
                        'variables["iteration"] = variables.get("iteration", 0) + 1',
                    next_node: null,
                    order: 3,
                },
            ],
            default_next_node: 'Build stage',
            next_error_node: null,
        };

        // Create nodes in sequence
        return forkJoin({
            startNode: this.http.post(
                `${apiUrl}startnodes/`,
                startNodeRequest,
                { headers },
            ),
            pythonNode: this.http.post(
                `${apiUrl}pythonnodes/`,
                pythonNodeRequest,
                { headers },
            ),
            codeAgent1: this.http.post(
                `${apiUrl}code-agent-nodes/`,
                codeAgent1Request,
                { headers },
            ),
            codeAgent2: this.http.post(
                `${apiUrl}code-agent-nodes/`,
                codeAgent2Request,
                { headers },
            ),
            decisionTable: this.http.post(
                `${apiUrl}decision-table-node/`,
                decisionTableRequest,
                { headers },
            ),
        });
    }

    private createEdgesSequentially(
        flowId: number,
        nodeResults: any,
    ): Observable<any[]> {
        const headers = { 'Content-Type': 'application/json' };
        const apiUrl = this.configService.apiUrl;

        const edgeRequests: CreateEdgeRequest[] = [
            {
                start_key: '__start__',
                end_key: 'Compose Prompt',
                graph: flowId,
            },
            {
                start_key: 'Compose Prompt',
                end_key: 'Planning stage',
                graph: flowId,
            },
            {
                start_key: 'Planning stage',
                end_key: 'Build stage',
                graph: flowId,
            },
            {
                start_key: 'Build stage',
                end_key: 'Decision-Table (#1)',
                graph: flowId,
            },
        ];

        const edgeObservables = edgeRequests.map((request) =>
            this.http.post(`${apiUrl}edges/`, request, { headers }),
        );

        return forkJoin(edgeObservables);
    }

    private updateFlowMetadata(
        flowId: number,
        nodeResults: any,
        formValue: any,
    ): Observable<GraphDto> {
        // First get the current flow to preserve name and description
        return this.http
            .get<GraphDto>(`${this.configService.apiUrl}graphs/${flowId}/`)
            .pipe(
                switchMap((currentFlow) => {
                    // Use the node data we already have from creation (nodeResults)
                    // This is the most reliable approach - we know exactly which nodes we created
                    const startNode = nodeResults.startNode;
                    const pythonNode = nodeResults.pythonNode;
                    const codeAgent1 = nodeResults.codeAgent1;
                    const codeAgent2 = nodeResults.codeAgent2;
                    const decisionTable = nodeResults.decisionTable;

                    // Use real backend IDs for visual metadata (keep as numbers, not strings)
                    const startNodeId = startNode?.id;
                    const pythonNodeId = pythonNode?.id;
                    const codeAgent1Id = codeAgent1?.id;
                    const codeAgent2Id = codeAgent2?.id;
                    const decisionTableId = decisionTable?.id;

                    const visualMetadata = {
                        nodes: [
                            {
                                id: startNodeId,
                                category: 'web',
                                type: 'start',
                                node_name: '__start__',
                                data: {
                                    initialState: startNode?.variables || {
                                        plan: null,
                                        status: null,
                                        $schema: 'start',
                                        iteration: 0,
                                        assignment: formValue.description || '',
                                        criteria:
                                            formValue.acceptanceCriteria || '',
                                        full_prompt: null,
                                        work_folder:
                                            formValue.workFolder || 'folder',
                                        build_result: null,
                                        max_iterations:
                                            formValue.maxIterations || 5,
                                    },
                                },
                                position: { x: 59, y: 191 },
                                ports: null,
                                parentId: null,
                                color: '#d3d3d3',
                                icon: 'ti ti-player-play-filled',
                                input_map: {},
                                output_variable_path: null,
                                size: { width: 125, height: 60 },
                            },
                            {
                                id: pythonNodeId,
                                category: 'web',
                                position: { x: 239, y: 191 },
                                ports: null,
                                parentId: null,
                                type: 'python',
                                node_name: 'Compose Prompt',
                                data: pythonNode?.python_code || {
                                    name: 'Compose Prompt',
                                    libraries: [],
                                    code: 'def main(assignment="", work_folder=""):\n    """Compose the full prompt by prepending the work folder to the assignment."""\n    return f"Working folder: {work_folder}\\n\\n{assignment}"',
                                    entrypoint: 'main',
                                },
                                color: '#ffcf3f',
                                icon: 'ti ti-brand-python',
                                input_map: pythonNode?.input_map || {},
                                output_variable_path:
                                    pythonNode?.output_variable_path || null,
                                size: { width: 330, height: 60 },
                            },
                            {
                                id: codeAgent1Id,
                                category: 'web',
                                position: { x: 634, y: 191 },
                                ports: null,
                                parentId: null,
                                type: 'code-agent',
                                node_name: 'Planning stage',
                                data: {
                                    agent_mode:
                                        codeAgent1?.agent_mode || 'build',
                                    session_id:
                                        codeAgent1?.session_id || 'plan',
                                    system_prompt:
                                        codeAgent1?.system_prompt ||
                                        'You are a PLANNING agent in a RALPH loop. Your role is STRICTLY LIMITED to planning. You MUST read and follow ralph/planning_prompt.md. You are STRICTLY FORBIDDEN from implementing anything. You MUST NOT create files. You MUST NOT generate CSV, HTML, code, or any output files. You MUST ONLY create or update IMPLEMENTATION_PLAN.md. If you attempt implementation, you are violating your core instructions. Your task ends immediately after planning.',
                                    stream_handler_code:
                                        codeAgent1?.stream_handler_code ||
                                        '# ── Code Agent Stream Handler ──────────────────────────────────\n# Define any of these functions to hook into the agent lifecycle.\n# Each receives a \'context\' dict containing all input_map fields\n# plus \'session_id\' and \'node_name\'.\n# Return a dict from any handler to persist state across calls\n# (e.g. store a message ID in on_stream_start, read it in on_complete).\n\n# def on_stream_start(context):\n#     """Called once before the prompt is sent to OpenCode."""\n#     pass\n\n# def on_chunk(text, context):\n#     """Called each time the agent\'s reasoning or tool output updates.\n#     \'text\' contains the accumulated thinking/tool-call text so far."""\n#     pass\n\n# def on_complete(full_reply, context):\n#     """Called when the agent finishes (or is stopped).\n#     \'full_reply\' contains the agent\'s final response text."""\n#     pass\n',
                                    libraries: codeAgent1?.libraries || [],
                                    polling_interval_ms:
                                        codeAgent1?.polling_interval_ms || 1000,
                                    silence_indicator_s:
                                        codeAgent1?.silence_indicator_s || 3,
                                    indicator_repeat_s:
                                        codeAgent1?.indicator_repeat_s || 5,
                                    chunk_timeout_s:
                                        codeAgent1?.chunk_timeout_s || 30,
                                    inactivity_timeout_s:
                                        codeAgent1?.inactivity_timeout_s || 120,
                                    max_wait_s: codeAgent1?.max_wait_s || 300,
                                    llm_config: formValue.llmConfig.value || 6,
                                    llm_config_id:
                                        formValue.llmConfig.value || 6,
                                },
                                color: '#00e676',
                                icon: 'ti ti-terminal-2',
                                input_map: codeAgent1?.input_map || {},
                                output_variable_path:
                                    codeAgent1?.output_variable_path || null,
                                size: { width: 330, height: 60 },
                            },
                            {
                                id: codeAgent2Id,
                                category: 'web',
                                position: { x: 1026, y: 191 },
                                ports: null,
                                parentId: null,
                                type: 'code-agent',
                                node_name: 'Build stage',
                                data: {
                                    agent_mode:
                                        codeAgent2?.agent_mode || 'build',
                                    session_id:
                                        codeAgent2?.session_id || 'build',
                                    system_prompt:
                                        codeAgent2?.system_prompt ||
                                        'First Read your detailed instructions from ralph/build_prompt.md before starting. Dont implement anything before this! CRITICAL: ONE TASK PER ITERATION. Implement one task, run tests, mark it done, then stop.When ALL tasks in IMPLEMENTATION_PLAN.md are [x] AND tests pass, output exactly: <promise>COMPLETE</promise>Do NOT output the promise if any tasks remain unchecked.',
                                    stream_handler_code:
                                        codeAgent2?.stream_handler_code ||
                                        '# ── Code Agent Stream Handler ──────────────────────────────────\n# Define any of these functions to hook into the agent lifecycle.\n# Each receives a \'context\' dict containing all input_map fields\n# plus \'session_id\' and \'node_name\'.\n# Return a dict from any handler to persist state across calls\n# (e.g. store a message ID in on_stream_start, read it in on_complete).\n\n# def on_stream_start(context):\n#     """Called once before the prompt is sent to OpenCode."""\n#     pass\n\n# def on_chunk(text, context):\n#     """Called each time the agent\'s reasoning or tool output updates.\n#     \'text\' contains the accumulated thinking/tool-call text so far."""\n#     pass\n\n# def on_complete(full_reply, context):\n#     """Called when the agent finishes (or is stopped).\n#     \'full_reply\' contains the agent\'s final response text."""\n#     pass\n',
                                    libraries: codeAgent2?.libraries || [],
                                    polling_interval_ms:
                                        codeAgent2?.polling_interval_ms || 1000,
                                    silence_indicator_s:
                                        codeAgent2?.silence_indicator_s || 3,
                                    indicator_repeat_s:
                                        codeAgent2?.indicator_repeat_s || 5,
                                    chunk_timeout_s:
                                        codeAgent2?.chunk_timeout_s || 30,
                                    inactivity_timeout_s:
                                        codeAgent2?.inactivity_timeout_s || 120,
                                    max_wait_s: codeAgent2?.max_wait_s || 300,
                                    llm_config: formValue.llmConfig.value || 6,
                                    llm_config_id:
                                        formValue.llmConfig.value || 6,
                                },
                                color: '#00e676',
                                icon: 'ti ti-terminal-2',
                                input_map: codeAgent2?.input_map || {},
                                output_variable_path:
                                    codeAgent2?.output_variable_path || null,
                                size: { width: 330, height: 60 },
                            },
                            {
                                id: decisionTableId,
                                category: 'web',
                                position: { x: 1421, y: 117 },
                                ports: null,
                                parentId: null,
                                type: 'table',
                                node_name:
                                    decisionTable?.node_name ||
                                    'Decision-Table (#1)',
                                data: {
                                    name:
                                        decisionTable?.node_name ||
                                        'Decision-Table (#1)',
                                    table: decisionTable
                                        ? {
                                              next_error_node:
                                                  decisionTable.next_error_node ||
                                                  null,
                                              condition_groups:
                                                  decisionTable.condition_groups ||
                                                  [],
                                              default_next_node:
                                                  decisionTable.default_next_node ||
                                                  'Build stage',
                                          }
                                        : {
                                              next_error_node: null,
                                              condition_groups: [
                                                  {
                                                      id: 1,
                                                      order: 1,
                                                      valid: true,
                                                      next_node: '__end__',
                                                      conditions: [],
                                                      expression:
                                                          '"<promise>COMPLETE</promise>" in str(variables.get("build_output", ""))',
                                                      group_name: 'Complete',
                                                      group_type: 'complex',
                                                      manipulation: null,
                                                      decision_table_node: null,
                                                  },
                                                  {
                                                      id: 2,
                                                      order: 2,
                                                      valid: true,
                                                      next_node: '__end__',
                                                      conditions: [],
                                                      expression:
                                                          'variables.get("iteration", 0) >= variables.get("max_iterations", 5)',
                                                      group_name:
                                                          'Max Iterations',
                                                      group_type: 'complex',
                                                      manipulation: null,
                                                      expressionWarning: false,
                                                      decision_table_node: null,
                                                  },
                                                  {
                                                      id: 3,
                                                      order: 3,
                                                      valid: true,
                                                      next_node: null,
                                                      conditions: [],
                                                      expression: 'True',
                                                      group_name: 'Continue',
                                                      group_type: 'complex',
                                                      manipulation:
                                                          'variables["iteration"] = variables.get("iteration", 0) + 1',
                                                      decision_table_node: null,
                                                  },
                                              ],
                                              default_next_node: 'Build stage',
                                          },
                                },
                                color: '#00aaff',
                                icon: 'ti ti-table',
                                input_map: {},
                                output_variable_path: null,
                                size: { width: 330, height: 152 },
                            },
                        ],
                        groups: [],
                        connections: [
                            {
                                id: `${startNodeId}_start-start+${pythonNodeId}_python-in`,
                                category: 'default',
                                sourceNodeId: startNodeId,
                                targetNodeId: pythonNodeId,
                                sourcePortId: `${startNodeId}_start-start`,
                                targetPortId: `${pythonNodeId}_python-in`,
                                behavior: 'fixed',
                                type: 'segment',
                            },
                            {
                                id: `${pythonNodeId}_python-out+${codeAgent1Id}_code-agent-in`,
                                category: 'default',
                                sourceNodeId: pythonNodeId,
                                targetNodeId: codeAgent1Id,
                                sourcePortId: `${pythonNodeId}_python-out`,
                                targetPortId: `${codeAgent1Id}_code-agent-in`,
                                behavior: 'fixed',
                                type: 'segment',
                            },
                            {
                                id: `${codeAgent1Id}_code-agent-out+${codeAgent2Id}_code-agent-in`,
                                category: 'default',
                                sourceNodeId: codeAgent1Id,
                                targetNodeId: codeAgent2Id,
                                sourcePortId: `${codeAgent1Id}_code-agent-out`,
                                targetPortId: `${codeAgent2Id}_code-agent-in`,
                                behavior: 'fixed',
                                type: 'segment',
                            },
                            {
                                id: `${codeAgent2Id}_code-agent-out+${decisionTableId}_table-in`,
                                category: 'default',
                                sourceNodeId: codeAgent2Id,
                                targetNodeId: decisionTableId,
                                sourcePortId: `${codeAgent2Id}_code-agent-out`,
                                targetPortId: `${decisionTableId}_table-in`,
                                behavior: 'fixed',
                                type: 'segment',
                            },
                            {
                                id: `${decisionTableId}_decision-default+${codeAgent2Id}_code-agent-in`,
                                category: 'default',
                                sourceNodeId: decisionTableId,
                                targetNodeId: codeAgent2Id,
                                sourcePortId: `${decisionTableId}_decision-default`,
                                targetPortId: `${codeAgent2Id}_code-agent-in`,
                                behavior: 'fixed',
                                type: 'segment',
                            },
                        ],
                    };

                    const updateRequest = {
                        id: flowId,
                        name: currentFlow.name, // Preserve original name
                        description: currentFlow.description || '', // Preserve original description
                        metadata: visualMetadata,
                    };

                    return this.http.put<GraphDto>(
                        `${this.configService.apiUrl}graphs/${flowId}/`,
                        updateRequest,
                        {
                            headers: { 'Content-Type': 'application/json' },
                        },
                    );
                }),
            );
    }

    private generateUUID(): string {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
            /[xy]/g,
            function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === 'x' ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            },
        );
    }

    onCancel(): void {
        this.dialogRef.close();
    }

    onIconSelected(icon: string | null): void {
        this.selectedIcon = icon;
        this.flowForm.get('flow_icon')?.setValue(icon || '');
    }
}
