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
            isRalph: true,
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
        const workFolder = formValue.workFolder || 'folder';
        const buildSystemPrompt =
            'You are the BUILD agent in a RALPH loop. You implement ONE task per iteration.\n\n' +
            `=== STEP 1: EXTRACT WORKING FOLDER ===\n` +
            `Your prompt ALWAYS starts with: "Working folder: ${workFolder}"\n` +
            `${workFolder} is the actual folder name you must use for ALL file operations.\n\n` +
            '=== STEP 2: READ FILES IN CORRECT ORDER ===\n' +
            '1. Read ralph/build_prompt.md (general instructions)\n' +
            `2. Read ${workFolder}/IMPLEMENTATION_PLAN.md\n` +
            `3. Read ${workFolder}/PROGRESS.md if it exists\n\n` +
            '=== STEP 3: COMPLETE ONE TASK ===\n' +
            '1. Find the FIRST unchecked task in IMPLEMENTATION_PLAN.md: - [ ] Task name\n' +
            `2. Implement ONLY that task in the ${workFolder}/ directory\n` +
            `3. Update ${workFolder}/IMPLEMENTATION_PLAN.md: change - [ ] to - [x] for completed task\n` +
            `4. Update ${workFolder}/PROGRESS.md with what you did\n` +
            '5. Output structured JSON (required format defined in schema)\n\n' +
            '=== PATH EXAMPLES ===\n' +
            `Working folder: ${workFolder}\n` +
            '→ Read: ralph/build_prompt.md\n' +
            `→ Read: ${workFolder}/IMPLEMENTATION_PLAN.md\n` +
            `→ Create files in: ${workFolder}/index.html, ${workFolder}/app.js, etc.\n` +
            `→ Update: ${workFolder}/IMPLEMENTATION_PLAN.md and ${workFolder}/PROGRESS.md\n\n` +
            '=== COMPLETION CHECK ===\n' +
            'all_complete = true ONLY if ALL tasks are [x] AND tests pass\n' +
            'If all_complete = true, include <promise>COMPLETE</promise> in message field\n\n' +
            'CRITICAL: Complete ONE task, output JSON, then STOP.';

        const startNodeRequest: CreateStartNodeRequest = {
            graph: flowId,
            variables: {
                plan: null,
                status: null,
                $schema: 'start',
                iteration: 0,
                assignment: formValue.description || '',
                criteria: formValue.acceptanceCriteria || '',
                plan_prompt: '',
                build_prompt: `Working folder: ${formValue.workFolder || ''}\n\n${formValue.description || ''}\n\n${formValue.acceptanceCriteria || ''}\n\n${buildSystemPrompt}`,
                work_folder: formValue.workFolder || '',
                build_result: null,
                max_iterations: formValue.maxIterations || 5,
            },
        };

        const pythonNodeRequest: CreatePythonNodeRequest = {
            graph: flowId,
            node_name: 'Compose Prompt',
            python_code: {
                libraries: [],
                code: 'def main(assignment: str = "", work_folder: str = "") -> str:\n    """Build the planning prompt for the Ralph planning agent."""\n\n    plan_prompt = f"""Working folder: {work_folder}\n\nPLANNING AGENT - Your task is to create an execution plan for the following request.\n\nSTEP 1 - EXTRACT OR CREATE FOLDER IF IT DOES NOT EXIST:\nThe working folder for this task is: {work_folder}\nALL file operations MUST use this folder.\n\nSTEP 2 - READ GUIDELINES:\nRead ralph/planning_prompt.md for detailed planning instructions.\n\nSTEP 3 - CREATE IMPLEMENTATION PLAN:\nCreate {work_folder}/IMPLEMENTATION_PLAN.md with a checklist of concrete implementation tasks.\n\nUse this format:\n- [ ] Task description here\n- [ ] Next task description\n\nBreak down the user request into specific, actionable steps.\n\nDO NOT create meta-tasks like:\n- [ ] Create IMPLEMENTATION_PLAN.md\n- [ ] Write code for the project\n\nCREATE actual implementation tasks like:\n- [ ] Install required Python libraries (pandas, openpyxl)\n- [ ] Create Python script to generate DataFrame with specified columns\n- [ ] Add 20 empty rows to the DataFrame\n- [ ] Export DataFrame to .xls format\n- [ ] Save file as {work_folder}/table.xls\n\nSTEP 4 - OUTPUT JSON:\nReturn structured JSON matching your output schema with:\n- status: \"plan_created\"\n- files_created: [{{\"path\": \"{work_folder}/IMPLEMENTATION_PLAN.md\", \"format_valid\": true}}]\n- plan_summary: {{task_count, first_task, project_description}}\n- message: Summary of what you created\n\nCRITICAL RULES:\n- Create files in {work_folder}/ directory, NOT ralph/\n- Do NOT write implementation code, only create the plan\n- Do NOT create files other than {work_folder}/IMPLEMENTATION_PLAN.md\n\nUSER REQUEST:\n{assignment}\n"""\n\n    return plan_prompt',
                entrypoint: 'main',
            },
            input_map: {
                assignment: 'variables.assignment',
                work_folder: 'variables.work_folder',
            },
            output_variable_path: 'variables.plan_prompt',
            stream_config: {
                execution_status: true,
            },
        };

        const codeAgent1Request: CreateCodeAgentNodeRequest = {
            graph: flowId,
            node_name: 'Planning stage',
            llm_config: formValue.llmConfig.value || 6,
            agent_mode: 'plan',
            session_id: `${flowId}_planning`,
            system_prompt: '',
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
                prompt: 'variables.plan_prompt',
            },
            output_variable_path: 'variables.plan_output',
            stream_config: {
                reasoning: false,
                tool_calls: false,
                tool_results: false,
                final_reply: true,
            },
            output_schema: {
                type: 'object',
                required: [
                    'status',
                    'files_created',
                    'plan_summary',
                    'message',
                ],
                properties: {
                    status: {
                        type: 'string',
                        enum: ['plan_created', 'plan_updated'],
                        description: 'Status of planning phase completion',
                    },
                    files_created: {
                        type: 'array',
                        description: 'List of files created during planning',
                        items: {
                            type: 'object',
                            required: ['path', 'format_valid'],
                            properties: {
                                path: {
                                    type: 'string',
                                    description:
                                        'Full path to the file (e.g., <working_folder>/IMPLEMENTATION_PLAN.md)',
                                },
                                format_valid: {
                                    type: 'boolean',
                                    description:
                                        'True if file uses required checklist format: - [ ] Task name',
                                },
                            },
                        },
                        minItems: 1,
                    },
                    plan_summary: {
                        type: 'object',
                        required: [
                            'task_count',
                            'first_task',
                            'project_description',
                        ],
                        properties: {
                            task_count: {
                                type: 'number',
                                description:
                                    'Total number of tasks in IMPLEMENTATION_PLAN.md',
                                minimum: 1,
                            },
                            first_task: {
                                type: 'string',
                                description: 'Name of the first unchecked task',
                            },
                            project_description: {
                                type: 'string',
                                description:
                                    'Brief description of what the project is',
                            },
                        },
                    },
                    message: {
                        type: 'string',
                        description:
                            'Human-readable summary of planning completion',
                    },
                },
                additionalProperties: false,
            },
        };

        const codeAgent2Request: CreateCodeAgentNodeRequest = {
            graph: flowId,
            node_name: 'Build stage',
            llm_config: formValue.llmConfig.value || 6,
            agent_mode: 'build',
            session_id: `${flowId}_build`,
            system_prompt: '',
            // 'You are the BUILD agent in a RALPH loop. You implement ONE task per iteration.\n\n' +
            // '=== STEP 1: EXTRACT WORKING FOLDER ===\n' +
            // 'Your prompt ALWAYS starts with: "Working folder: XXXXX"\n' +
            // 'XXXXX is the actual folder name you must use for ALL file operations.\n\n' +
            // 'Examples:\n' +
            // '- "Working folder: smart" → use "smart" as the folder\n' +
            // '- "Working folder: test" → use "test" as the folder\n' +
            // '- "Working folder: my_app" → use "my_app" as the folder\n\n' +
            // '=== STEP 2: READ FILES IN CORRECT ORDER ===\n' +
            // '1. Read ralph/build_prompt.md (general instructions)\n' +
            // '2. Read XXXXX/IMPLEMENTATION_PLAN.md (where XXXXX = working folder from Step 1)\n' +
            // '3. Read XXXXX/PROGRESS.md if it exists\n\n' +
            // '=== STEP 3: COMPLETE ONE TASK ===\n' +
            // '1. Find the FIRST unchecked task in IMPLEMENTATION_PLAN.md: - [ ] Task name\n' +
            // '2. Implement ONLY that task in the XXXXX/ directory\n' +
            // '3. Update XXXXX/IMPLEMENTATION_PLAN.md: change - [ ] to - [x] for completed task\n' +
            // '4. Update XXXXX/PROGRESS.md with what you did\n' +
            // '5. Output structured JSON (required format defined in schema)\n\n' +
            // '=== PATH EXAMPLES ===\n' +
            // 'If prompt = "Working folder: smart Create a web app..."\n' +
            // '→ Working folder is: smart\n' +
            // '→ Read: ralph/build_prompt.md\n' +
            // '→ Read: smart/IMPLEMENTATION_PLAN.md\n' +
            // '→ Create files in: smart/index.html, smart/app.js, etc.\n' +
            // '→ Update: smart/IMPLEMENTATION_PLAN.md and smart/PROGRESS.md\n\n' +
            // '=== COMPLETION CHECK ===\n' +
            // 'all_complete = true ONLY if ALL tasks are [x] AND tests pass\n' +
            // 'If all_complete = true, include <promise>COMPLETE</promise> in message field\n\n' +
            // 'CRITICAL: Complete ONE task, output JSON, then STOP.',
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
                prompt: 'variables.build_prompt',
            },
            output_variable_path: 'variables.build_output',
            stream_config: {
                reasoning: false,
                tool_calls: true,
                tool_results: true,
                final_reply: true,
            },
            output_schema: {
                type: 'object',
                required: [
                    'iteration_summary',
                    'task_status',
                    'all_complete',
                    'message',
                ],
                properties: {
                    iteration_summary: {
                        type: 'object',
                        required: [
                            'completed_task',
                            'tasks_remaining',
                            'tests_passed',
                        ],
                        properties: {
                            completed_task: {
                                type: 'string',
                                description:
                                    'The ONE task you completed this iteration (or "none" if orienting)',
                            },
                            tasks_remaining: {
                                type: 'number',
                                description:
                                    'Number of unchecked [ ] tasks left in IMPLEMENTATION_PLAN.md',
                                minimum: 0,
                            },
                            tests_passed: {
                                type: 'boolean',
                                description:
                                    'Whether tests passed for the task you completed',
                            },
                        },
                    },
                    task_status: {
                        type: 'object',
                        required: [
                            'plan_file_updated',
                            'progress_file_updated',
                        ],
                        properties: {
                            plan_file_updated: {
                                type: 'boolean',
                                description:
                                    'True if you marked the task [x] in IMPLEMENTATION_PLAN.md',
                            },
                            progress_file_updated: {
                                type: 'boolean',
                                description:
                                    'True if you updated PROGRESS.md with this iteration',
                            },
                        },
                    },
                    all_complete: {
                        type: 'boolean',
                        description:
                            'True ONLY if ALL tasks in IMPLEMENTATION_PLAN.md are [x] AND all tests pass',
                    },
                    message: {
                        type: 'string',
                        description:
                            'Summary of what you did. If all_complete=true, MUST contain: <promise>COMPLETE</promise>',
                    },
                },
                additionalProperties: false,
            },
        };

        const decisionTableRequest: CreateDecisionTableNodeRequest = {
            graph: flowId,
            node_name: 'Decision-Table (#1)',
            condition_groups: [
                {
                    group_name: 'Complete',
                    group_type: 'complex',
                    expression:
                        'variables.get("build_output", {}).get("all_complete", False) == True or "<promise>COMPLETE</promise>" in str(variables.get("build_output", ""))',
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
        const workFolder = formValue.workFolder || 'folder';
        const buildSystemPrompt =
            'You are the BUILD agent in a RALPH loop. You implement ONE task per iteration.\n\n' +
            `=== STEP 1: EXTRACT WORKING FOLDER ===\n` +
            `Your prompt ALWAYS starts with: "Working folder: ${workFolder}"\n` +
            `${workFolder} is the actual folder name you must use for ALL file operations.\n\n` +
            '=== STEP 2: READ FILES IN CORRECT ORDER ===\n' +
            '1. Read ralph/build_prompt.md (general instructions)\n' +
            `2. Read ${workFolder}/IMPLEMENTATION_PLAN.md\n` +
            `3. Read ${workFolder}/PROGRESS.md if it exists\n\n` +
            '=== STEP 3: COMPLETE ONE TASK ===\n' +
            '1. Find the FIRST unchecked task in IMPLEMENTATION_PLAN.md: - [ ] Task name\n' +
            `2. Implement ONLY that task in the ${workFolder}/ directory\n` +
            `3. Update ${workFolder}/IMPLEMENTATION_PLAN.md: change - [ ] to - [x] for completed task\n` +
            `4. Update ${workFolder}/PROGRESS.md with what you did\n` +
            '5. Output structured JSON (required format defined in schema)\n\n' +
            '=== PATH EXAMPLES ===\n' +
            `Working folder: ${workFolder}\n` +
            '→ Read: ralph/build_prompt.md\n' +
            `→ Read: ${workFolder}/IMPLEMENTATION_PLAN.md\n` +
            `→ Create files in: ${workFolder}/index.html, ${workFolder}/app.js, etc.\n` +
            `→ Update: ${workFolder}/IMPLEMENTATION_PLAN.md and ${workFolder}/PROGRESS.md\n\n` +
            '=== COMPLETION CHECK ===\n' +
            'all_complete = true ONLY if ALL tasks are [x] AND tests pass\n' +
            'If all_complete = true, include <promise>COMPLETE</promise> in message field\n\n' +
            'CRITICAL: Complete ONE task, output JSON, then STOP.';

        return this.http
            .get<GraphDto>(`${this.configService.apiUrl}graphs/${flowId}/`)
            .pipe(
                switchMap((currentFlow) => {
                    const startNode = nodeResults.startNode;
                    const pythonNode = nodeResults.pythonNode;
                    const codeAgent1 = nodeResults.codeAgent1;
                    const codeAgent2 = nodeResults.codeAgent2;
                    const decisionTable = nodeResults.decisionTable;

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
                                        plan_prompt: '',
                                        build_prompt: `Working folder: ${formValue.workFolder || ''}\n\n${formValue.description || ''}\n\n${formValue.acceptanceCriteria || ''}\n\n${buildSystemPrompt}`,
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
                                    code: 'def main(assignment: str = "", work_folder: str = "") -> str:\n    """Build the planning prompt for the Ralph planning agent."""\n\n    full_prompt = f"""Working folder: {work_folder}\n\nPLANNING AGENT - Your task is to create an execution plan for the following request.\n\nSTEP 1 - EXTRACT OR CREATE FOLDER IF IT DOES NOT EXIST:\nThe working folder for this task is: {work_folder}\nALL file operations MUST use this folder.\n\nSTEP 2 - READ GUIDELINES:\nRead ralph/planning_prompt.md for detailed planning instructions.\n\nSTEP 3 - CREATE IMPLEMENTATION PLAN:\nCreate {work_folder}/IMPLEMENTATION_PLAN.md with a checklist of concrete implementation tasks.\n\nUse this format:\n- [ ] Task description here\n- [ ] Next task description\n\nBreak down the user request into specific, actionable steps.\n\nDO NOT create meta-tasks like:\n- [ ] Create IMPLEMENTATION_PLAN.md\n- [ ] Write code for the project\n\nCREATE actual implementation tasks like:\n- [ ] Install required Python libraries (pandas, openpyxl)\n- [ ] Create Python script to generate DataFrame with specified columns\n- [ ] Add 20 empty rows to the DataFrame\n- [ ] Export DataFrame to .xls format\n- [ ] Save file as {work_folder}/table.xls\n\nSTEP 4 - OUTPUT JSON:\nReturn structured JSON matching your output schema with:\n- status: \"plan_created\"\n- files_created: [{{\"path\": \"{work_folder}/IMPLEMENTATION_PLAN.md\", \"format_valid\": true}}]\n- plan_summary: {{task_count, first_task, project_description}}\n- message: Summary of what you created\n\nCRITICAL RULES:\n- Create files in {work_folder}/ directory, NOT ralph/\n- Do NOT write implementation code, only create the plan\n- Do NOT create files other than {work_folder}/IMPLEMENTATION_PLAN.md\n\nUSER REQUEST:\n{assignment}\n"""\n\n    return full_prompt',
                                    entrypoint: 'main',
                                },
                                color: '#ffcf3f',
                                icon: 'ti ti-brand-python',
                                input_map: pythonNode?.input_map || {},
                                output_variable_path:
                                    pythonNode?.output_variable_path || null,
                                size: { width: 330, height: 60 },
                                stream_config: {
                                    execution_status:
                                        pythonNode?.stream_config
                                            ?.execution_status || true,
                                },
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
                                        codeAgent1?.agent_mode || 'plan',
                                    session_id:
                                        codeAgent1?.session_id || 'plan',
                                    system_prompt:
                                        codeAgent1?.system_prompt || '',
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
                                    stream_config: {
                                        reasoning:
                                            codeAgent1?.stream_config
                                                ?.reasoning || false,
                                        tool_calls:
                                            codeAgent1?.stream_config
                                                ?.tool_calls || false,
                                        tool_results:
                                            codeAgent1?.stream_config
                                                ?.tool_results || false,
                                        final_reply:
                                            codeAgent1?.stream_config
                                                ?.final_reply || true,
                                    },
                                    output_schema:
                                        codeAgent1?.output_schema || {
                                            type: 'object',
                                            required: [
                                                'status',
                                                'files_created',
                                                'plan_summary',
                                                'message',
                                            ],
                                            properties: {
                                                status: {
                                                    type: 'string',
                                                    enum: [
                                                        'plan_created',
                                                        'plan_updated',
                                                    ],
                                                    description:
                                                        'Status of planning phase completion',
                                                },
                                                files_created: {
                                                    type: 'array',
                                                    description:
                                                        'List of files created during planning',
                                                    items: {
                                                        type: 'object',
                                                        required: [
                                                            'path',
                                                            'format_valid',
                                                        ],
                                                        properties: {
                                                            path: {
                                                                type: 'string',
                                                                description:
                                                                    'Full path to the file',
                                                            },
                                                            format_valid: {
                                                                type: 'boolean',
                                                                description:
                                                                    'True if file uses required checklist format',
                                                            },
                                                        },
                                                    },
                                                    minItems: 1,
                                                },
                                                plan_summary: {
                                                    type: 'object',
                                                    required: [
                                                        'task_count',
                                                        'first_task',
                                                        'project_description',
                                                    ],
                                                    properties: {
                                                        task_count: {
                                                            type: 'number',
                                                            description:
                                                                'Total number of tasks',
                                                            minimum: 1,
                                                        },
                                                        first_task: {
                                                            type: 'string',
                                                            description:
                                                                'Name of the first unchecked task',
                                                        },
                                                        project_description: {
                                                            type: 'string',
                                                            description:
                                                                'Brief description of what the project is',
                                                        },
                                                    },
                                                },
                                                message: {
                                                    type: 'string',
                                                    description:
                                                        'Human-readable summary',
                                                },
                                            },
                                            additionalProperties: false,
                                        },
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
                                        codeAgent2?.system_prompt || '',
                                    // 'You are the BUILD agent in a RALPH loop. You implement ONE task per iteration.\n\n=== STEP 1: EXTRACT WORKING FOLDER ===\nYour prompt ALWAYS starts with: "Working folder: XXXXX"\nXXXXX is the actual folder name you must use for ALL file operations.\n\nExamples:\n- "Working folder: smart" → use "smart" as the folder\n- "Working folder: test" → use "test" as the folder\n- "Working folder: my_app" → use "my_app" as the folder\n\n=== STEP 2: READ FILES IN CORRECT ORDER ===\n1. Read ralph/build_prompt.md (general instructions)\n2. Read XXXXX/IMPLEMENTATION_PLAN.md (where XXXXX = working folder from Step 1)\n3. Read XXXXX/PROGRESS.md if it exists\n\n=== STEP 3: COMPLETE ONE TASK ===\n1. Find the FIRST unchecked task in IMPLEMENTATION_PLAN.md: - [ ] Task name\n2. Implement ONLY that task in the XXXXX/ directory\n3. Update XXXXX/IMPLEMENTATION_PLAN.md: change - [ ] to - [x] for completed task\n4. Update XXXXX/PROGRESS.md with what you did\n5. Output structured JSON (required format defined in schema)\n\n=== PATH EXAMPLES ===\nIf prompt = "Working folder: smart Create a web app..."\n→ Working folder is: smart\n→ Read: ralph/build_prompt.md\n→ Read: smart/IMPLEMENTATION_PLAN.md\n→ Create files in: smart/index.html, smart/app.js, etc.\n→ Update: smart/IMPLEMENTATION_PLAN.md and smart/PROGRESS.md\n\n=== COMPLETION CHECK ===\nall_complete = true ONLY if ALL tasks are [x] AND tests pass\nIf all_complete = true, include <promise>COMPLETE</promise> in message field\n\nCRITICAL: Complete ONE task, output JSON, then STOP.',
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
                                    stream_config: {
                                        reasoning:
                                            codeAgent2?.stream_config
                                                ?.reasoning || false,
                                        tool_calls:
                                            codeAgent2?.stream_config
                                                ?.tool_calls || true,
                                        tool_results:
                                            codeAgent2?.stream_config
                                                ?.tool_results || true,
                                        final_reply:
                                            codeAgent2?.stream_config
                                                ?.final_reply || true,
                                    },
                                    output_schema:
                                        codeAgent2?.output_schema || {
                                            type: 'object',
                                            required: [
                                                'iteration_summary',
                                                'task_status',
                                                'all_complete',
                                                'message',
                                            ],
                                            properties: {
                                                iteration_summary: {
                                                    type: 'object',
                                                    required: [
                                                        'completed_task',
                                                        'tasks_remaining',
                                                        'tests_passed',
                                                    ],
                                                    properties: {
                                                        completed_task: {
                                                            type: 'string',
                                                            description:
                                                                'The ONE task you completed this iteration',
                                                        },
                                                        tasks_remaining: {
                                                            type: 'number',
                                                            description:
                                                                'Number of unchecked [ ] tasks left',
                                                            minimum: 0,
                                                        },
                                                        tests_passed: {
                                                            type: 'boolean',
                                                            description:
                                                                'Whether tests passed',
                                                        },
                                                    },
                                                },
                                                task_status: {
                                                    type: 'object',
                                                    required: [
                                                        'plan_file_updated',
                                                        'progress_file_updated',
                                                    ],
                                                    properties: {
                                                        plan_file_updated: {
                                                            type: 'boolean',
                                                            description:
                                                                'True if task marked [x] in IMPLEMENTATION_PLAN.md',
                                                        },
                                                        progress_file_updated: {
                                                            type: 'boolean',
                                                            description:
                                                                'True if PROGRESS.md updated',
                                                        },
                                                    },
                                                },
                                                all_complete: {
                                                    type: 'boolean',
                                                    description:
                                                        'True ONLY if ALL tasks are [x] AND tests pass',
                                                },
                                                message: {
                                                    type: 'string',
                                                    description:
                                                        'Summary. If all_complete=true, MUST contain <promise>COMPLETE</promise>',
                                                },
                                            },
                                            additionalProperties: false,
                                        },
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
                        name: currentFlow.name,
                        description: currentFlow.description || '',
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

    onCancel(): void {
        this.dialogRef.close();
    }

    onIconSelected(icon: string | null): void {
        this.selectedIcon = icon;
        this.flowForm.get('flow_icon')?.setValue(icon || '');
    }
}
