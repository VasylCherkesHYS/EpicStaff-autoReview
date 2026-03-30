/**
 * Pure functions — no Angular/RxJS dependencies.
 *
 * Responsibilities:
 *   1. extractPreviousState  — pull the current backend state out of GraphDto
 *   2. extractNewState       — pull the current UI state out of FlowModel
 *   3. getNodeOnlyDiff       — compare node-only states (Phase 1)
 *   4. getConnectionDiff     — compare edge/cond-edge states after IDs are known (Phase 2)
 *   5. Payload builders      — convert UI nodes into API request bodies
 */

import { isEqual } from 'lodash';

import { GraphDto } from '../../../features/flows/models/graph.model';
import { GetProjectRequest } from '../../../features/projects/models/project.model';
import { CreateAudioToTextNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/audio-to-text.model';
import { CreateCodeAgentNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/code-agent-node.model';
import {
    ConditionalEdge,
    CreateConditionalEdgeRequest,
} from '../../../pages/flows-page/components/flow-visual-programming/models/conditional-edge.model';
import { CreateCrewNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/crew-node.model';
import {
    CreateConditionGroupRequest,
    CreateDecisionTableNodeRequest,
} from '../../../pages/flows-page/components/flow-visual-programming/models/decision-table-node.model';
import { CreateEdgeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/edge.model';
import { CreateEndNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/end-node.model';
import { CreateFileExtractorNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/file-extractor.model';
import {
    CreateGraphNoteRequest,
    GraphNote,
} from '../../../pages/flows-page/components/flow-visual-programming/models/graph-note.model';
import { CreateLLMNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/llm-node.model';
import { CreatePythonNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/python-node.model';
import { StartNode } from '../../../pages/flows-page/components/flow-visual-programming/models/start-node.model';
import { CreateSubGraphNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/subgraph-node.model';
import { CreateTelegramTriggerNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/telegram-trigger.model';
import { CreateWebhookTriggerNodeRequest } from '../../../pages/flows-page/components/flow-visual-programming/models/webhook-trigger';
import { NodeType } from '../../core/enums/node-type';
import { ConnectionModel } from '../../core/models/connection.model';
import { FlowModel } from '../../core/models/flow.model';
import {
    AudioToTextNodeModel,
    BaseNodeModel,
    CodeAgentNodeModel,
    DecisionTableNodeModel,
    EdgeNodeModel,
    EndNodeModel,
    FileExtractorNodeModel,
    GraphNoteModel,
    LLMNodeModel,
    NodeModel,
    ProjectNodeModel,
    PythonNodeModel,
    StartNodeModel,
    SubGraphNodeModel,
    TelegramTriggerNodeModel,
    WebhookTriggerNodeModel,
} from '../../core/models/node.model';
import {
    getAudioToTextNodeForComparisonFromBackend,
    getAudioToTextNodeForComparisonFromUI,
    getCodeAgentNodeForComparisonFromBackend,
    getCodeAgentNodeForComparisonFromUI,
    getConditionalEdgeForComparisonFromBackend,
    getConditionalEdgeForComparisonFromUI,
    getCrewNodeForComparisonFromBackend,
    getCrewNodeForComparisonFromUI,
    getDecisionTableNodeForComparisonFromBackend,
    getDecisionTableNodeForComparisonFromUI,
    getEndNodeForComparisonFromBackend,
    getEndNodeForComparisonFromUI,
    getFileExtractorNodeForComparisonFromBackend,
    getFileExtractorNodeForComparisonFromUI,
    getGraphNoteForComparisonFromBackend,
    getGraphNoteForComparisonFromUI,
    getLLMNodeForComparisonFromBackend,
    getLLMNodeForComparisonFromUI,
    getPythonNodeForComparisonFromBackend,
    getPythonNodeForComparisonFromUI,
    getStartNodeForComparisonFromBackend,
    getStartNodeForComparisonFromUI,
    getSubGraphNodeForComparisonFromBackend,
    getSubGraphNodeForComparisonFromUI,
    getTelegramTriggerNodeForComparisonFromBackend,
    getTelegramTriggerNodeForComparisonFromUI,
    getWebhookTriggerNodeForComparisonFromBackend,
    getWebhookTriggerNodeForComparisonFromUI,
} from './save-graph.comparators';
import {
    ConnectionDiff,
    CreatedNodeMapping,
    getUIMetadataForComparison,
    GraphNewState,
    GraphPreviousState,
    NodeDiff,
    NodeOnlyDiff,
    NodeUIMetadata,
    ResolvedConditionalEdge,
    ResolvedUiEdge,
    UiEdge,
} from './save-graph.types';

// ─────────────────────────────────────────────────────────────────────────────
// Generic diff utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Diffs two lists by matching UI nodes to backend nodes via `backendId`.
 */
export function diffByKey<TBackend extends { id: number }, TUI>(
    backendNodes: TBackend[],
    uiNodes: TUI[],
    getUIBackendId: (node: TUI) => number | null,
    toComparableFromBackend: (node: TBackend) => unknown,
    toComparableFromUI: (node: TUI) => unknown,
    nodeTypeName: string = 'Node'
): NodeDiff<TBackend, TUI> {
    const backendMap = new Map<number, TBackend>();
    for (const node of backendNodes) {
        backendMap.set(node.id, node);
    }

    const toDelete: TBackend[] = [];
    const toCreate: TUI[] = [];
    const toUpdate: Array<{ backend: TBackend; ui: TUI }> = [];
    const matchedBackendIds = new Set<number>();

    for (const uiNode of uiNodes) {
        const bid = getUIBackendId(uiNode);

        if (bid == null) {
            toCreate.push(uiNode);
            continue;
        }

        const backendNode = backendMap.get(bid);
        if (!backendNode) {
            toCreate.push(uiNode);
            continue;
        }

        matchedBackendIds.add(bid);

        const backendComparable = toComparableFromBackend(backendNode);
        const uiComparable = toComparableFromUI(uiNode);
        const areEqual = isEqual(backendComparable, uiComparable);

        if (!areEqual) {
            toUpdate.push({ backend: backendNode, ui: uiNode });
        }
    }

    for (const [id, backendNode] of backendMap) {
        if (!matchedBackendIds.has(id)) {
            toDelete.push(backendNode);
        }
    }

    return { toDelete, toCreate, toUpdate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Extract previous state (backend → structured object)
// ─────────────────────────────────────────────────────────────────────────────

export function extractPreviousState(graph: GraphDto): GraphPreviousState {
    return {
        startNodes: graph.start_node_list ?? [],
        crewNodes: graph.crew_node_list ?? [],
        pythonNodes: graph.python_node_list ?? [],
        llmNodes: graph.llm_node_list ?? [],
        fileExtractorNodes: graph.file_extractor_node_list ?? [],
        audioToTextNodes: graph.audio_transcription_node_list ?? [],
        subGraphNodes: graph.subgraph_node_list ?? [],
        webhookTriggerNodes: graph.webhook_trigger_node_list ?? [],
        telegramTriggerNodes: graph.telegram_trigger_node_list ?? [],
        conditionalEdges: graph.conditional_edge_list ?? [],
        edges: graph.edge_list ?? [],
        endNodes: graph.end_node_list ?? [],
        decisionTableNodes: graph.decision_table_node_list ?? [],
        graphNotes: graph.graph_note_list ?? [],
        codeAgentNodes: graph.code_agent_node_list ?? [],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Extract new state (UI FlowModel → structured object)
// ─────────────────────────────────────────────────────────────────────────────

/** Resolves a frontend UUID to a backend ID using the node list. */
function resolveBackendId(uuid: string | null, allNodes: NodeModel[]): number | null {
    if (!uuid) return null;
    const match = allNodes.find((n) => n.id === uuid);
    return match?.backendId ?? null;
}

/**
 * Resolves each EdgeNodeModel to its source and target node UUIDs and backend IDs.
 */
function resolveConditionalEdges(
    edgeNodes: EdgeNodeModel[],
    connections: ConnectionModel[],
    allNodes: NodeModel[]
): ResolvedConditionalEdge[] {
    return edgeNodes.map((edgeNode) => {
        const incomingConnection = connections.find((c) => c.targetNodeId === edgeNode.id);
        const sourceNode = incomingConnection ? allNodes.find((n) => n.id === incomingConnection.sourceNodeId) : null;

        const outgoingConnection = connections.find((c) => c.sourceNodeId === edgeNode.id);
        const targetNode = outgoingConnection ? allNodes.find((n) => n.id === outgoingConnection.targetNodeId) : null;

        return {
            edgeNode,
            sourceNodeUuid: sourceNode?.id ?? null,
            targetNodeUuid: targetNode?.id ?? null,
            sourceBackendId: sourceNode?.backendId ?? null,
            targetBackendId: targetNode?.backendId ?? null,
        };
    });
}

/**
 * Converts valid flow connections into UiEdge entries with UUIDs and backend IDs,
 * filtering out connections that involve EDGE or TABLE source nodes.
 */
function resolveEdges(connections: ConnectionModel[], allNodes: NodeModel[]): UiEdge[] {
    const nodeById = new Map(allNodes.map((n) => [n.id, n]));
    const result: UiEdge[] = [];

    for (const conn of connections) {
        const source = nodeById.get(conn.sourceNodeId);
        const target = nodeById.get(conn.targetNodeId);
        if (!source || !target) continue;
        if (source.type === NodeType.EDGE || target.type === NodeType.EDGE) continue;
        if (source.type === NodeType.TABLE) continue;
        result.push({
            sourceNodeUuid: source.id,
            targetNodeUuid: target.id,
            sourceBackendId: source.backendId,
            targetBackendId: target.backendId,
        });
    }

    return result;
}

export function extractNewState(flowState: FlowModel): GraphNewState {
    const { nodes, connections } = flowState;

    const edgeNodeModels = nodes.filter((n) => n.type === NodeType.EDGE) as EdgeNodeModel[];

    return {
        startNodes: nodes.filter((n) => n.type === NodeType.START && n.category !== 'vscode') as StartNodeModel[],
        crewNodes: nodes.filter((n) => n.type === NodeType.PROJECT) as ProjectNodeModel[],
        pythonNodes: nodes.filter((n) => n.type === NodeType.PYTHON) as PythonNodeModel[],
        llmNodes: nodes.filter((n) => n.type === NodeType.LLM) as LLMNodeModel[],
        fileExtractorNodes: nodes.filter((n) => n.type === NodeType.FILE_EXTRACTOR) as FileExtractorNodeModel[],
        audioToTextNodes: nodes.filter((n) => n.type === NodeType.AUDIO_TO_TEXT) as AudioToTextNodeModel[],
        subGraphNodes: nodes.filter((n) => n.type === NodeType.SUBGRAPH) as SubGraphNodeModel[],
        webhookTriggerNodes: nodes.filter((n) => n.type === NodeType.WEBHOOK_TRIGGER) as WebhookTriggerNodeModel[],
        telegramTriggerNodes: nodes.filter((n) => n.type === NodeType.TELEGRAM_TRIGGER) as TelegramTriggerNodeModel[],
        conditionalEdges: resolveConditionalEdges(edgeNodeModels, connections, nodes),
        edges: resolveEdges(connections, nodes),
        graphNotes: nodes.filter((n) => n.type === NodeType.NOTE) as GraphNoteModel[],
        endNodes: nodes.filter((n) => n.type === NodeType.END) as EndNodeModel[],
        codeAgentNodes: nodes.filter((n) => n.type === NodeType.CODE_AGENT) as CodeAgentNodeModel[],
        decisionTableNodes: nodes.filter((n) => n.type === NodeType.TABLE) as DecisionTableNodeModel[],
        allNodes: nodes,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3a — Node-only diff (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────

export function getNodeOnlyDiff(previous: GraphPreviousState, current: GraphNewState): NodeOnlyDiff {
    const allNodes = current.allNodes;

    const startNodes = diffByKey(
        previous.startNodes,
        current.startNodes,
        (n) => n.backendId,
        getStartNodeForComparisonFromBackend,
        getStartNodeForComparisonFromUI,
        'StartNode'
    );

    const crewNodes = diffByKey(
        previous.crewNodes,
        current.crewNodes,
        (n) => n.backendId,
        getCrewNodeForComparisonFromBackend,
        getCrewNodeForComparisonFromUI,
        'CrewNode'
    );

    const pythonNodes = diffByKey(
        previous.pythonNodes,
        current.pythonNodes,
        (n) => n.backendId,
        getPythonNodeForComparisonFromBackend,
        getPythonNodeForComparisonFromUI,
        'PythonNode'
    );

    const llmNodes = diffByKey(
        previous.llmNodes,
        current.llmNodes,
        (n) => n.backendId,
        getLLMNodeForComparisonFromBackend,
        getLLMNodeForComparisonFromUI,
        'LLMNode'
    );

    const fileExtractorNodes = diffByKey(
        previous.fileExtractorNodes,
        current.fileExtractorNodes,
        (n) => n.backendId,
        getFileExtractorNodeForComparisonFromBackend,
        getFileExtractorNodeForComparisonFromUI,
        'FileExtractorNode'
    );

    const audioToTextNodes = diffByKey(
        previous.audioToTextNodes,
        current.audioToTextNodes,
        (n) => n.backendId,
        getAudioToTextNodeForComparisonFromBackend,
        getAudioToTextNodeForComparisonFromUI,
        'AudioToTextNode'
    );

    const subGraphNodes = diffByKey(
        previous.subGraphNodes,
        current.subGraphNodes,
        (n) => n.backendId,
        getSubGraphNodeForComparisonFromBackend,
        getSubGraphNodeForComparisonFromUI,
        'SubGraphNode'
    );

    const webhookTriggerNodes = diffByKey(
        previous.webhookTriggerNodes,
        current.webhookTriggerNodes,
        (n) => n.backendId,
        getWebhookTriggerNodeForComparisonFromBackend,
        getWebhookTriggerNodeForComparisonFromUI,
        'WebhookTriggerNode'
    );

    const telegramTriggerNodes = diffByKey(
        previous.telegramTriggerNodes,
        current.telegramTriggerNodes,
        (n) => n.backendId,
        getTelegramTriggerNodeForComparisonFromBackend,
        getTelegramTriggerNodeForComparisonFromUI,
        'TelegramTriggerNode'
    );

    const decisionTableNodes = diffByKey(
        previous.decisionTableNodes,
        current.decisionTableNodes,
        (n) => n.backendId,
        getDecisionTableNodeForComparisonFromBackend,
        (n) => getDecisionTableNodeForComparisonFromUI(n, allNodes),
        'DecisionTableNode'
    );

    const endNodes = diffByKey(
        previous.endNodes,
        current.endNodes,
        (n) => n.backendId,
        getEndNodeForComparisonFromBackend,
        getEndNodeForComparisonFromUI,
        'EndNode'
    );

    const graphNotes = diffByKey(
        previous.graphNotes,
        current.graphNotes,
        (n) => n.backendId,
        getGraphNoteForComparisonFromBackend,
        getGraphNoteForComparisonFromUI,
        'GraphNote'
    );

    const codeAgentNodes = diffByKey(
        previous.codeAgentNodes,
        current.codeAgentNodes,
        (n) => n.backendId,
        getCodeAgentNodeForComparisonFromBackend,
        getCodeAgentNodeForComparisonFromUI,
        'CodeAgentNode'
    );

    return {
        startNodes,
        crewNodes,
        pythonNodes,
        llmNodes,
        fileExtractorNodes,
        audioToTextNodes,
        subGraphNodes,
        webhookTriggerNodes,
        telegramTriggerNodes,
        decisionTableNodes,
        endNodes,
        graphNotes,
        codeAgentNodes,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3b — Connection diff (Phase 2 — after node backend IDs are resolved)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a complete UUID → backendId map from the current node list
 * plus any newly-created node mappings from Phase 1.
 */
export function buildUuidToBackendIdMap(
    allNodes: NodeModel[],
    createdMappings: CreatedNodeMapping[]
): Map<string, number> {
    const map = new Map<string, number>();
    for (const node of allNodes) {
        if (node.backendId != null) {
            map.set(node.id, node.backendId);
        }
    }
    for (const m of createdMappings) {
        map.set(m.uiNodeId, m.backendId);
    }
    return map;
}

/**
 * Updates ResolvedConditionalEdges with backend IDs from the complete map.
 */
export function resolveConditionalEdgeIds(
    condEdges: ResolvedConditionalEdge[],
    idMap: Map<string, number>
): ResolvedConditionalEdge[] {
    return condEdges.map((re) => ({
        ...re,
        sourceBackendId: re.sourceNodeUuid ? (idMap.get(re.sourceNodeUuid) ?? re.sourceBackendId) : re.sourceBackendId,
        targetBackendId: re.targetNodeUuid ? (idMap.get(re.targetNodeUuid) ?? re.targetBackendId) : re.targetBackendId,
    }));
}

/**
 * Resolves UI edges to backend IDs and computes the edge diff (create/delete only).
 */
export function getConnectionDiff(
    previousEdges: GraphPreviousState['edges'],
    previousCondEdges: GraphPreviousState['conditionalEdges'],
    currentEdges: UiEdge[],
    currentCondEdges: ResolvedConditionalEdge[],
    idMap: Map<string, number>
): ConnectionDiff {
    // ── Resolve UI edge backend IDs ──
    const resolvedUiEdges: ResolvedUiEdge[] = currentEdges
        .map((e) => ({
            start_node_id: idMap.get(e.sourceNodeUuid) ?? e.sourceBackendId,
            end_node_id: idMap.get(e.targetNodeUuid) ?? e.targetBackendId,
        }))
        .filter((e): e is ResolvedUiEdge => e.start_node_id != null && e.end_node_id != null);

    // ── Edge diff (create/delete only, no update) ──
    const backendEdgeMap = new Map(previousEdges.map((e) => [`${e.start_node_id}__${e.end_node_id}`, e]));
    const uiEdgeKeys = new Set(resolvedUiEdges.map((e) => `${e.start_node_id}__${e.end_node_id}`));
    const edgesToDelete = previousEdges.filter((e) => !uiEdgeKeys.has(`${e.start_node_id}__${e.end_node_id}`));
    const edgesToCreate = resolvedUiEdges.filter((e) => !backendEdgeMap.has(`${e.start_node_id}__${e.end_node_id}`));

    // ── Conditional edge diff ──
    const resolvedCondEdges = resolveConditionalEdgeIds(currentCondEdges, idMap);
    const conditionalEdgesRaw = diffByKey(
        previousCondEdges,
        resolvedCondEdges,
        (n) => n.edgeNode.backendId,
        getConditionalEdgeForComparisonFromBackend,
        getConditionalEdgeForComparisonFromUI,
        'ConditionalEdge'
    );
    const conditionalEdges = conditionalEdgesRaw;

    return {
        conditionalEdges,
        edges: { toDelete: edgesToDelete, toCreate: edgesToCreate },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Payload builders (UI node → API request body)
// ─────────────────────────────────────────────────────────────────────────────

export function buildCrewPayload(n: ProjectNodeModel, graphId: number): CreateCrewNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        crew_id: (n.data as GetProjectRequest).id,
        input_map: n.input_map || {},
        output_variable_path: n.output_variable_path || null,
        stream_config: n.stream_config ?? {},
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildPythonPayload(n: PythonNodeModel, graphId: number): CreatePythonNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        python_code: n.data,
        input_map: n.input_map || {},
        output_variable_path: n.output_variable_path || null,
        stream_config: n.stream_config ?? {},
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildLLMPayload(n: LLMNodeModel, graphId: number): CreateLLMNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        llm_config: n.data.id,
        input_map: n.input_map || {},
        output_variable_path: n.output_variable_path || null,
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildFileExtractorPayload(n: FileExtractorNodeModel, graphId: number): CreateFileExtractorNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        input_map: n.input_map || {},
        output_variable_path: n.output_variable_path || null,
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildAudioToTextPayload(n: AudioToTextNodeModel, graphId: number): CreateAudioToTextNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        input_map: n.input_map || {},
        output_variable_path: n.output_variable_path || null,
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildSubGraphPayload(n: SubGraphNodeModel, graphId: number): CreateSubGraphNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        subgraph: n.data.id,
        input_map: n.input_map || {},
        output_variable_path: n.output_variable_path || null,
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildWebhookPayload(n: WebhookTriggerNodeModel, graphId: number): CreateWebhookTriggerNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        python_code: n.data.python_code,
        input_map: n.input_map || {},
        output_variable_path: n.output_variable_path || null,
        webhook_trigger_path: '',
        webhook_trigger: n.data.webhook_trigger,
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildTelegramPayload(n: TelegramTriggerNodeModel, graphId: number): CreateTelegramTriggerNodeRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        telegram_bot_api_key: n.data.telegram_bot_api_key,
        webhook_trigger: n.data.webhook_trigger,
        fields: n.data.fields,
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildCondEdgePayload(re: ResolvedConditionalEdge, graphId: number): CreateConditionalEdgeRequest {
    return {
        graph: graphId,
        source_node_id: re.sourceBackendId ?? null,
        python_code: re.edgeNode.data.python_code,
        input_map: re.edgeNode.input_map || {},
        metadata: {
            ...getUIMetadataForComparison(re.edgeNode),
            then_node_id: re.targetBackendId ?? null,
        },
    };
}

export function buildEdgePayload(e: ResolvedUiEdge, graphId: number): CreateEdgeRequest {
    return { start_node_id: e.start_node_id, end_node_id: e.end_node_id, graph: graphId };
}

export function buildEndNodePayload(n: EndNodeModel, graphId: number): CreateEndNodeRequest {
    return {
        graph: graphId,
        output_map: n.data.output_map ?? { context: 'variables.context' },
        metadata: getUIMetadataForComparison(n),
    };
}

/** Resolves a UUID to a backend ID using idMap first (Phase 2), then falling back to allNodes. */
function resolveBackendIdWithMap(
    uuid: string | null,
    allNodes: NodeModel[],
    idMap?: Map<string, number>
): number | null {
    if (!uuid) return null;
    if (idMap) {
        const mapped = idMap.get(uuid);
        if (mapped != null) return mapped;
    }
    return resolveBackendId(uuid, allNodes);
}

export function buildDecisionTablePayload(
    node: DecisionTableNodeModel,
    graphId: number,
    allNodes: NodeModel[],
    idMap?: Map<string, number>
): CreateDecisionTableNodeRequest {
    const tableData = node.data.table;

    const conditionGroups: CreateConditionGroupRequest[] = tableData.condition_groups
        .filter((g) => g.valid !== false)
        .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER))
        .map((g, idx) => ({
            group_name: g.group_name,
            group_type: g.group_type,
            expression: g.expression,
            conditions: g.conditions.map((c) => ({
                condition_name: c.condition_name,
                condition: c.condition,
            })),
            manipulation: g.manipulation,
            next_node_id: resolveBackendIdWithMap(g.next_node, allNodes, idMap),
            order: typeof g.order === 'number' ? g.order : idx + 1,
        }));

    return {
        graph: graphId,
        node_name: node.node_name,
        condition_groups: conditionGroups,
        default_next_node_id: resolveBackendIdWithMap(tableData?.default_next_node, allNodes, idMap),
        next_error_node_id: resolveBackendIdWithMap(tableData?.next_error_node, allNodes, idMap),
        metadata: getUIMetadataForComparison(node),
    };
}

export function buildStartNodePayload(n: StartNodeModel, graphId: number) {
    return {
        graph: graphId,
        variables: n.data.initialState,
        metadata: getUIMetadataForComparison(n),
    };
}

export function buildGraphNotePayload(n: GraphNoteModel, graphId: number): CreateGraphNoteRequest {
    return {
        node_name: n.node_name,
        graph: graphId,
        content: n.data.content,
        metadata: {
            ...getUIMetadataForComparison(n),
            backgroundColor: n.data.backgroundColor ?? null,
        },
    };
}

export function buildCodeAgentPayload(node: CodeAgentNodeModel, graphId: number): CreateCodeAgentNodeRequest {
    return {
        node_name: node.node_name,
        graph: graphId,
        llm_config: node.data?.llm_config_id ?? null,
        agent_mode: node.data?.agent_mode ?? 'code_interpreter',
        session_id: node.data?.session_id ?? '',
        system_prompt: node.data?.system_prompt ?? '',
        stream_handler_code: node.data?.stream_handler_code ?? '',
        libraries: node.data?.libraries ?? [],
        polling_interval_ms: node.data?.polling_interval_ms ?? 100,
        silence_indicator_s: node.data?.silence_indicator_s ?? 3,
        indicator_repeat_s: node.data?.indicator_repeat_s ?? 5,
        chunk_timeout_s: node.data?.chunk_timeout_s ?? 30,
        inactivity_timeout_s: node.data?.inactivity_timeout_s ?? 120,
        max_wait_s: node.data?.max_wait_s ?? 300,
        input_map: node.input_map,
        output_variable_path: node.output_variable_path,
        stream_config: node.stream_config ?? {},
        output_schema: node.data?.output_schema ?? {},
        metadata: getUIMetadataForComparison(node),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk save payload builder  (POST /graphs/{id}/save/)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes the conditional-edge diff and returns both the resolved edges and the diff.
 * Exported so the service can use resolved edges for Phase-2 ref updates.
 */
export function buildConditionalEdgeDiff(
    previousCondEdges: ConditionalEdge[],
    currentCondEdges: ResolvedConditionalEdge[],
    idMap: Map<string, number>
): { diff: NodeDiff<ConditionalEdge, ResolvedConditionalEdge>; resolved: ResolvedConditionalEdge[] } {
    const resolved = resolveConditionalEdgeIds(currentCondEdges, idMap);
    const diff = diffByKey(
        previousCondEdges,
        resolved,
        (n) => n.edgeNode.backendId,
        getConditionalEdgeForComparisonFromBackend,
        getConditionalEdgeForComparisonFromUI,
        'ConditionalEdge'
    );
    return { diff, resolved };
}

/**
 * Builds the single payload for POST /graphs/{id}/save/.
 *
 * - New nodes  → id: null, temp_id: UI-UUID  (edges reference new nodes via temp_id)
 * - Updated    → id: backendId
 * - Deleted    → collected in `deleted` sub-object
 * - Regular edges to new nodes → start_temp_id / end_temp_id instead of node IDs
 * - Conditional edges to new source nodes → source_temp_id
 *   (then_node_id in metadata stays null if target is new — fixed in Phase 2)
 */
export function buildBulkSavePayload(
    nodeDiff: NodeOnlyDiff,
    conditionalEdgeDiff: NodeDiff<ConditionalEdge, ResolvedConditionalEdge>,
    previousState: GraphPreviousState,
    newState: GraphNewState,
    graphId: number,
    idMap: Map<string, number>
): Record<string, unknown> {
    // ── Helper: build list items for one node type ──────────────────────────
    function buildNodeItems<TBackend extends { id: number }, TUI extends BaseNodeModel>(
        diff: NodeDiff<TBackend, TUI>,
        toPayload: (n: TUI) => object
    ): unknown[] {
        return [
            ...diff.toCreate.map((n) => ({ ...toPayload(n), id: null, temp_id: n.id })),
            ...diff.toUpdate.map(({ backend, ui }) => ({ ...toPayload(ui), id: backend.id })),
        ];
    }

    // ── Regular edge list ───────────────────────────────────────────────────
    const backendEdgeSet = new Set(previousState.edges.map((e) => `${e.start_node_id}__${e.end_node_id}`));
    const edge_list: unknown[] = [];

    for (const edge of newState.edges) {
        const srcId = idMap.get(edge.sourceNodeUuid) ?? edge.sourceBackendId;
        const tgtId = idMap.get(edge.targetNodeUuid) ?? edge.targetBackendId;

        // Skip edges that already exist between two known backend nodes
        if (srcId != null && tgtId != null && backendEdgeSet.has(`${srcId}__${tgtId}`)) {
            continue;
        }

        const item: Record<string, unknown> = { graph: graphId };
        if (srcId != null) {
            item['start_node_id'] = srcId;
        } else {
            item['start_temp_id'] = edge.sourceNodeUuid;
        }
        if (tgtId != null) {
            item['end_node_id'] = tgtId;
        } else {
            item['end_temp_id'] = edge.targetNodeUuid;
        }
        edge_list.push(item);
    }

    // Edges deleted: in backend but no longer in UI
    const uiEdgeKeys = new Set(
        newState.edges.map((e) => {
            const s = idMap.get(e.sourceNodeUuid) ?? e.sourceBackendId;
            const t = idMap.get(e.targetNodeUuid) ?? e.targetBackendId;
            return `${s}__${t}`;
        })
    );
    const deletedEdgeIds = previousState.edges
        .filter((e) => !uiEdgeKeys.has(`${e.start_node_id}__${e.end_node_id}`))
        .map((e) => e.id);

    // ── Conditional edge list ───────────────────────────────────────────────
    const conditional_edge_list: unknown[] = [];

    function buildCondEdgeBulkItem(re: ResolvedConditionalEdge, backendId?: number): Record<string, unknown> {
        const sourceId = re.sourceNodeUuid ? (idMap.get(re.sourceNodeUuid) ?? re.sourceBackendId) : re.sourceBackendId;
        const targetId = re.targetNodeUuid ? (idMap.get(re.targetNodeUuid) ?? re.targetBackendId) : re.targetBackendId;

        const item: Record<string, unknown> = {
            graph: graphId,
            python_code: re.edgeNode.data.python_code,
            input_map: re.edgeNode.input_map || {},
            metadata: {
                ...getUIMetadataForComparison(re.edgeNode),
                then_node_id: targetId ?? null,
            },
        };

        if (backendId != null) {
            item['id'] = backendId;
        } else {
            item['temp_id'] = re.edgeNode.id;
        }

        if (sourceId != null) {
            item['source_node_id'] = sourceId;
        } else {
            item['source_temp_id'] = re.sourceNodeUuid;
        }

        return item;
    }

    for (const re of conditionalEdgeDiff.toCreate) {
        conditional_edge_list.push(buildCondEdgeBulkItem(re));
    }
    for (const { backend, ui } of conditionalEdgeDiff.toUpdate) {
        conditional_edge_list.push(buildCondEdgeBulkItem(ui, backend.id));
    }

    // ── Assemble payload ────────────────────────────────────────────────────
    return {
        start_node_list: buildNodeItems(nodeDiff.startNodes, (n) => buildStartNodePayload(n, graphId)),
        crew_node_list: buildNodeItems(nodeDiff.crewNodes, (n) => buildCrewPayload(n, graphId)),
        python_node_list: buildNodeItems(nodeDiff.pythonNodes, (n) => buildPythonPayload(n, graphId)),
        llm_node_list: buildNodeItems(nodeDiff.llmNodes, (n) => buildLLMPayload(n, graphId)),
        file_extractor_node_list: buildNodeItems(nodeDiff.fileExtractorNodes, (n) =>
            buildFileExtractorPayload(n, graphId)
        ),
        audio_transcription_node_list: buildNodeItems(nodeDiff.audioToTextNodes, (n) =>
            buildAudioToTextPayload(n, graphId)
        ),
        end_node_list: buildNodeItems(nodeDiff.endNodes, (n) => buildEndNodePayload(n, graphId)),
        subgraph_node_list: buildNodeItems(nodeDiff.subGraphNodes, (n) => buildSubGraphPayload(n, graphId)),
        webhook_trigger_node_list: buildNodeItems(nodeDiff.webhookTriggerNodes, (n) => buildWebhookPayload(n, graphId)),
        telegram_trigger_node_list: buildNodeItems(nodeDiff.telegramTriggerNodes, (n) =>
            buildTelegramPayload(n, graphId)
        ),
        decision_table_node_list: buildNodeItems(nodeDiff.decisionTableNodes, (n) =>
            buildDecisionTablePayload(n, graphId, newState.allNodes)
        ),
        graph_note_list: buildNodeItems(nodeDiff.graphNotes, (n) => buildGraphNotePayload(n, graphId)),
        code_agent_node_list: buildNodeItems(nodeDiff.codeAgentNodes, (n) => buildCodeAgentPayload(n, graphId)),
        edge_list,
        conditional_edge_list,
        deleted: {
            edge_ids: deletedEdgeIds,
            conditional_edge_ids: conditionalEdgeDiff.toDelete.map((e) => e.id),
            start_node_ids: nodeDiff.startNodes.toDelete.map((n) => n.id),
            crew_node_ids: nodeDiff.crewNodes.toDelete.map((n) => n.id),
            python_node_ids: nodeDiff.pythonNodes.toDelete.map((n) => n.id),
            llm_node_ids: nodeDiff.llmNodes.toDelete.map((n) => n.id),
            file_extractor_node_ids: nodeDiff.fileExtractorNodes.toDelete.map((n) => n.id),
            audio_transcription_node_ids: nodeDiff.audioToTextNodes.toDelete.map((n) => n.id),
            end_node_ids: nodeDiff.endNodes.toDelete.map((n) => n.id),
            subgraph_node_ids: nodeDiff.subGraphNodes.toDelete.map((n) => n.id),
            webhook_trigger_node_ids: nodeDiff.webhookTriggerNodes.toDelete.map((n) => n.id),
            telegram_trigger_node_ids: nodeDiff.telegramTriggerNodes.toDelete.map((n) => n.id),
            decision_table_node_ids: nodeDiff.decisionTableNodes.toDelete.map((n) => n.id),
            graph_note_ids: nodeDiff.graphNotes.toDelete.map((n) => n.id),
            code_agent_node_ids: nodeDiff.codeAgentNodes.toDelete.map((n) => n.id),
        },
    };
}

/**
 * After a bulk save, extracts { uiNodeId → backendId } mappings for nodes that
 * were newly created (had no backendId before the save).
 *
 * Matching strategy: node_name first (reliable for most types), positional fallback
 * for types without a stable name (e.g. EndNode).
 */
export function buildCreatedMappingsFromResponse(
    nodeDiff: NodeOnlyDiff,
    previousState: GraphPreviousState,
    responseGraph: GraphDto
): CreatedNodeMapping[] {
    const mappings: CreatedNodeMapping[] = [];

    function matchNodes(
        toCreate: BaseNodeModel[],
        previousIds: Set<number>,
        responseNodes: Array<{ id: number; node_name?: string }>
    ): void {
        if (!toCreate.length) return;
        const newResponseNodes = responseNodes.filter((n) => !previousIds.has(n.id));
        const used = new Set<number>();

        for (const uiNode of toCreate) {
            const byName = newResponseNodes.find((r) => !used.has(r.id) && r.node_name === uiNode.node_name);
            if (byName) {
                mappings.push({ uiNodeId: uiNode.id, backendId: byName.id });
                used.add(byName.id);
                continue;
            }
            const byPos = newResponseNodes.find((r) => !used.has(r.id));
            if (byPos) {
                mappings.push({ uiNodeId: uiNode.id, backendId: byPos.id });
                used.add(byPos.id);
            }
        }
    }

    matchNodes(
        nodeDiff.startNodes.toCreate,
        new Set(previousState.startNodes.map((n) => n.id)),
        responseGraph.start_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.crewNodes.toCreate,
        new Set(previousState.crewNodes.map((n) => n.id)),
        responseGraph.crew_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.pythonNodes.toCreate,
        new Set(previousState.pythonNodes.map((n) => n.id)),
        responseGraph.python_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.llmNodes.toCreate,
        new Set(previousState.llmNodes.map((n) => n.id)),
        responseGraph.llm_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.fileExtractorNodes.toCreate,
        new Set(previousState.fileExtractorNodes.map((n) => n.id)),
        responseGraph.file_extractor_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.audioToTextNodes.toCreate,
        new Set(previousState.audioToTextNodes.map((n) => n.id)),
        responseGraph.audio_transcription_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.endNodes.toCreate,
        new Set(previousState.endNodes.map((n) => n.id)),
        responseGraph.end_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.subGraphNodes.toCreate,
        new Set(previousState.subGraphNodes.map((n) => n.id)),
        responseGraph.subgraph_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.webhookTriggerNodes.toCreate,
        new Set(previousState.webhookTriggerNodes.map((n) => n.id)),
        responseGraph.webhook_trigger_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.telegramTriggerNodes.toCreate,
        new Set(previousState.telegramTriggerNodes.map((n) => n.id)),
        responseGraph.telegram_trigger_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.decisionTableNodes.toCreate,
        new Set(previousState.decisionTableNodes.map((n) => n.id)),
        responseGraph.decision_table_node_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.graphNotes.toCreate,
        new Set(previousState.graphNotes.map((n) => n.id)),
        responseGraph.graph_note_list as Array<{ id: number; node_name?: string }>
    );
    matchNodes(
        nodeDiff.codeAgentNodes.toCreate,
        new Set(previousState.codeAgentNodes.map((n) => n.id)),
        responseGraph.code_agent_node_list as Array<{ id: number; node_name?: string }>
    );

    return mappings;
}
