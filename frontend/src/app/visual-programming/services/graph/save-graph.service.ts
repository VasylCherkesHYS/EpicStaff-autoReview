import { Injectable } from '@angular/core';
import { forkJoin, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

import { GraphDto } from '../../../features/flows/models/graph.model';
import { FlowsApiService } from '../../../features/flows/services/flows-api.service';
import { ConditionalEdge } from '../../../pages/flows-page/components/flow-visual-programming/models/conditional-edge.model';
import { ConditionalEdgeService } from '../../../pages/flows-page/components/flow-visual-programming/services/conditional-edge.service';
import { DecisionTableNodeService } from '../../../pages/flows-page/components/flow-visual-programming/services/decision-table-node.service';
import {
    buildBulkSavePayload,
    buildCondEdgePayload,
    buildConditionalEdgeDiff,
    buildCreatedMappingsFromResponse,
    buildDecisionTablePayload,
    buildUuidToBackendIdMap,
    extractNewState,
    extractPreviousState,
    getNodeOnlyDiff,
} from './save-graph.diff';
import { CreatedNodeMapping, NodeDiff, ResolvedConditionalEdge } from './save-graph.types';

@Injectable({
    providedIn: 'root',
})
export class GraphUpdateService {
    constructor(
        private graphService: FlowsApiService,
        private conditionalEdgeService: ConditionalEdgeService,
        private decisionTableNodeService: DecisionTableNodeService
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    public saveGraph(
        flowState: Parameters<typeof extractNewState>[0],
        graph: GraphDto
    ): Observable<{
        graph: GraphDto;
        updatedNodes: Record<string, unknown>;
        createdMappings: CreatedNodeMapping[];
    }> {
        const previousState = extractPreviousState(graph);
        const newState = extractNewState(flowState);
        const nodeDiff = getNodeOnlyDiff(previousState, newState);
        const { id: graphId } = graph;

        // idMap using only currently-known backend IDs (new nodes have null backendId)
        const idMap = buildUuidToBackendIdMap(newState.allNodes, []);

        // Compute conditional edge diff (create / update / delete)
        const { diff: conditionalEdgeDiff } = buildConditionalEdgeDiff(
            previousState.conditionalEdges,
            newState.conditionalEdges,
            idMap
        );

        // Build the single bulk payload
        const payload = buildBulkSavePayload(nodeDiff, conditionalEdgeDiff, previousState, newState, graphId, idMap);

        // ── Single HTTP call to the bulk endpoint ────────────────────────────
        return this.graphService.bulkSaveGraph(graphId, payload).pipe(
            switchMap((responseGraph) => {
                // Map newly created nodes (UI UUID → backend ID) from response
                const createdMappings = buildCreatedMappingsFromResponse(nodeDiff, previousState, responseGraph);

                // Complete idMap now includes newly created node IDs
                const completeIdMap = buildUuidToBackendIdMap(newState.allNodes, createdMappings);

                // ── Phase 2: fix refs that were null because target was a new node ──
                const phase2$ =
                    createdMappings.length > 0
                        ? this.executePhase2(
                              conditionalEdgeDiff,
                              responseGraph,
                              previousState.conditionalEdges,
                              newState,
                              graphId,
                              completeIdMap
                          )
                        : of(null);

                return phase2$.pipe(
                    map(() => ({
                        graph: responseGraph,
                        updatedNodes: {},
                        createdMappings,
                    }))
                );
            }),
            catchError((err) => throwError(() => err))
        );
    }

    // ── Phase 2: update conditional edges and DT nodes whose refs were null ──

    private executePhase2(
        conditionalEdgeDiff: NodeDiff<ConditionalEdge, ResolvedConditionalEdge>,
        responseGraph: GraphDto,
        previousCondEdges: ConditionalEdge[],
        newState: ReturnType<typeof extractNewState>,
        graphId: number,
        idMap: Map<string, number>
    ): Observable<unknown> {
        const ops: Observable<unknown>[] = [];
        const prevCondIds = new Set(previousCondEdges.map((e) => e.id));

        // ── Conditional edges that need then_node_id resolved ─────────────────

        // Existing cond edges (toUpdate) that had null then_node_id
        for (const { backend, ui } of conditionalEdgeDiff.toUpdate) {
            if (ui.targetNodeUuid && !ui.targetBackendId && idMap.has(ui.targetNodeUuid)) {
                const resolvedSource = ui.sourceNodeUuid
                    ? (idMap.get(ui.sourceNodeUuid) ?? ui.sourceBackendId)
                    : ui.sourceBackendId;
                const payload = buildCondEdgePayload(
                    { ...ui, sourceBackendId: resolvedSource, targetBackendId: idMap.get(ui.targetNodeUuid)! },
                    graphId
                );
                ops.push(
                    this.conditionalEdgeService.updateConditionalEdge(backend.id, payload).pipe(
                        catchError((err) => {
                            console.error('[SaveGraph] Phase2 cond-edge update failed', err);
                            return of(null);
                        })
                    )
                );
            }
        }

        // Newly created cond edges (toCreate) that had null then_node_id
        for (const re of conditionalEdgeDiff.toCreate) {
            if (re.targetNodeUuid && !re.targetBackendId && idMap.has(re.targetNodeUuid)) {
                const resolvedSourceId = re.sourceNodeUuid
                    ? (idMap.get(re.sourceNodeUuid) ?? re.sourceBackendId)
                    : re.sourceBackendId;

                // Find the newly created backend cond edge by its source_node_id
                const backendCE = responseGraph.conditional_edge_list.find(
                    (ce) => !prevCondIds.has(ce.id) && ce.source_node_id === resolvedSourceId
                );

                if (backendCE) {
                    const payload = buildCondEdgePayload(
                        { ...re, sourceBackendId: resolvedSourceId, targetBackendId: idMap.get(re.targetNodeUuid)! },
                        graphId
                    );
                    ops.push(
                        this.conditionalEdgeService.updateConditionalEdge(backendCE.id, payload).pipe(
                            catchError((err) => {
                                console.error('[SaveGraph] Phase2 new cond-edge update failed', err);
                                return of(null);
                            })
                        )
                    );
                }
            }
        }

        // ── DT nodes: update existing ones with fully resolved next_node_id refs ─
        for (const dtNode of newState.decisionTableNodes.filter((n) => n.backendId != null)) {
            const payload = buildDecisionTablePayload(dtNode, graphId, newState.allNodes, idMap);
            ops.push(
                this.decisionTableNodeService.updateDecisionTableNode(dtNode.backendId!, payload).pipe(
                    catchError((err) => {
                        console.error('[SaveGraph] Phase2 DT update failed', err);
                        return of(null);
                    })
                )
            );
        }

        return ops.length ? forkJoin(ops) : of(null);
    }
}
