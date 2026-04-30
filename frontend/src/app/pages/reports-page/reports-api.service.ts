import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import { ApiGetRequest } from '../../core/models/api-request.model';
import { GetGraphLightRequest } from '../../features/flows/models/graph.model';
import { GraphSessionLight, GraphSessionStatus } from '../../features/flows/services/flows-sessions.service';
import { ConfigService } from '../../services/config/config.service';

// Prices per 1M tokens (input / output), OpenAI as of 2025
const OPENAI_PRICES: { prefix: string; input: number; output: number }[] = [
    { prefix: 'gpt-4.1-nano', input: 0.1, output: 0.4 },
    { prefix: 'gpt-4.1-mini', input: 0.4, output: 1.6 },
    { prefix: 'gpt-4.1', input: 2.0, output: 8.0 },
    { prefix: 'gpt-4o-mini', input: 0.15, output: 0.6 },
    { prefix: 'gpt-4o', input: 2.5, output: 10.0 },
    { prefix: 'gpt-4-turbo', input: 10.0, output: 30.0 },
    { prefix: 'gpt-4', input: 30.0, output: 60.0 },
    { prefix: 'gpt-3.5-turbo', input: 0.5, output: 1.5 },
    { prefix: 'o4-mini', input: 1.1, output: 4.4 },
    { prefix: 'o3-mini', input: 1.1, output: 4.4 },
    { prefix: 'o3', input: 10.0, output: 40.0 },
    { prefix: 'o1-mini', input: 3.0, output: 12.0 },
    { prefix: 'o1-preview', input: 15.0, output: 60.0 },
    { prefix: 'o1', input: 15.0, output: 60.0 },
];

function lookupPrice(modelName: string): { input: number; output: number } | null {
    const lower = modelName.toLowerCase();
    // Already sorted longest-first so more specific prefixes win
    return OPENAI_PRICES.find((p) => lower.startsWith(p.prefix)) ?? null;
}

function calcCost(promptTokens: number, completionTokens: number, modelName: string): number {
    const price = lookupPrice(modelName);
    if (!price) return 0;
    return (promptTokens * price.input + completionTokens * price.output) / 1_000_000;
}

const ACTIVE_STATUSES = new Set<string>([
    GraphSessionStatus.PENDING,
    GraphSessionStatus.RUNNING,
    GraphSessionStatus.WAITING_FOR_USER,
]);

export interface ActiveSessionItem {
    id: number;
    graphId: number;
    flowName: string;
    status: GraphSessionStatus;
    createdAt: string;
}

export interface TopFlowItem {
    graphId: number;
    name: string;
    count: number;
    tokens: number;
    modelName: string;
    cost: number;
}

export interface ReportsData {
    totalFlows: number;
    flowsWithSubflows: number;
    totalAgents: number;
    totalTools: number;
    totalSessions: number;
    sessionsToday: number;
    successRate: number;
    totalTokens: number;
    totalCost: number;
    statusCounts: Record<string, number>;
    topFlows: TopFlowItem[];
    avgSessionDurationMs: number;
    activeSessions: ActiveSessionItem[];
}

// ── raw API shapes ────────────────────────────────────────────────────────────

interface AgentRaw {
    id: number;
    name: string;
    llm_config: number;
}

interface ToolLight {
    id: number;
    name: string;
}

interface LLMModelRaw {
    id: number;
    name: string;
}

interface LLMConfigRaw {
    id: number;
    custom_name: string;
    model: number;
}

interface LLMNodeRaw {
    id: number;
    llm_config: number;
    llm_config_detail?: { model: number };
}

interface CrewNodeRaw {
    id: number;
    crew: { agents: number[] };
}

interface GraphRaw {
    id: number;
    llm_node_list: LLMNodeRaw[];
    crew_node_list: CrewNodeRaw[];
}

interface SessionDetailed {
    id: number;
    token_usage: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number } | null;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
    private http = inject(HttpClient);
    private configService = inject(ConfigService);

    loadReports(): Observable<ReportsData> {
        const base = this.configService.apiUrl;

        const flowsLightReq = this.http
            .get<ApiGetRequest<GetGraphLightRequest>>(`${base}graph-light/`)
            .pipe(map((r) => r.results));

        const graphsFullReq = this.http.get<ApiGetRequest<GraphRaw>>(`${base}graphs/`).pipe(map((r) => r.results));

        const agentsReq = this.http.get<ApiGetRequest<AgentRaw>>(`${base}agents/`).pipe(map((r) => r.results));

        const toolsReq = this.http.get<ApiGetRequest<ToolLight>>(`${base}tools/`).pipe(map((r) => r.results));

        const llmModelsReq = this.http
            .get<ApiGetRequest<LLMModelRaw>>(`${base}llm-models/`)
            .pipe(map((r) => new Map(r.results.map((m) => [m.id, m]))));

        const llmConfigsReq = this.http
            .get<ApiGetRequest<LLMConfigRaw>>(`${base}llm-configs/`)
            .pipe(map((r) => new Map(r.results.map((c) => [c.id, c]))));

        const sessionsLightReq = this.http
            .get<ApiGetRequest<GraphSessionLight>>(`${base}sessions/`, {
                params: new HttpParams().set('detailed', 'false').set('limit', '1000'),
            })
            .pipe(map((r) => r.results));

        const tokenMapReq = this.http
            .get<ApiGetRequest<SessionDetailed>>(`${base}sessions/`, {
                params: new HttpParams().set('detailed', 'true').set('limit', '1000'),
            })
            .pipe(
                map((r) => {
                    const m = new Map<number, { prompt: number; completion: number; total: number }>();
                    for (const s of r.results) {
                        if (s.token_usage?.total_tokens) {
                            m.set(s.id, {
                                total: s.token_usage.total_tokens ?? 0,
                                prompt: s.token_usage.prompt_tokens ?? 0,
                                completion: s.token_usage.completion_tokens ?? 0,
                            });
                        }
                    }
                    return m;
                })
            );

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const sessionsTodayReq = this.http
            .get<ApiGetRequest<{ id: number }>>(`${base}sessions/`, {
                params: new HttpParams()
                    .set('detailed', 'false')
                    .set('created_after', todayStart.toISOString())
                    .set('limit', '1'),
            })
            .pipe(map((r) => r.count));

        return forkJoin({
            flowsLight: flowsLightReq,
            graphsFull: graphsFullReq,
            agents: agentsReq,
            tools: toolsReq,
            llmModels: llmModelsReq,
            llmConfigs: llmConfigsReq,
            sessions: sessionsLightReq,
            tokenMap: tokenMapReq,
            sessionsToday: sessionsTodayReq,
        }).pipe(
            map(
                ({
                    flowsLight,
                    graphsFull,
                    agents,
                    tools,
                    llmModels,
                    llmConfigs,
                    sessions,
                    tokenMap,
                    sessionsToday,
                }) => {
                    // ── build lookup maps ─────────────────────────────────────────
                    const agentMap = new Map(agents.map((a) => [a.id, a]));
                    const graphMap = new Map(graphsFull.map((g) => [g.id, g]));

                    const resolveModelName = (graphId: number): string => {
                        const g = graphMap.get(graphId);
                        if (!g) return '—';

                        // 1. LLM node (direct model reference)
                        for (const node of g.llm_node_list ?? []) {
                            const modelId = node.llm_config_detail?.model ?? llmConfigs.get(node.llm_config)?.model;
                            if (modelId) {
                                const name = llmModels.get(modelId)?.name;
                                if (name) return name;
                            }
                        }

                        // 2. Crew node → first agent → llm_config → model
                        for (const node of g.crew_node_list ?? []) {
                            for (const agentId of node.crew?.agents ?? []) {
                                const agent = agentMap.get(agentId);
                                if (agent) {
                                    const modelId = llmConfigs.get(agent.llm_config)?.model;
                                    if (modelId) {
                                        const name = llmModels.get(modelId)?.name;
                                        if (name) return name;
                                    }
                                }
                            }
                        }

                        return '—';
                    };

                    // ── aggregate sessions ────────────────────────────────────────
                    const statusCounts: Record<string, number> = {};
                    let totalTokens = 0;
                    let totalCost = 0;
                    let endedWithDuration = 0;
                    let totalDurationMs = 0;

                    const flowRunCounts = new Map<string, number>();
                    const flowTokenCounts = new Map<string, number>();
                    const flowPromptMap = new Map<string, number>();
                    const flowCompletMap = new Map<string, number>();
                    const flowIdMap = new Map<string, number>();

                    for (const s of sessions) {
                        const status = s.status ?? 'unknown';
                        statusCounts[status] = (statusCounts[status] ?? 0) + 1;

                        const tok = tokenMap.get(s.id);
                        const sessionTokens = tok?.total ?? 0;
                        totalTokens += sessionTokens;

                        const name = s.graph_name || 'Unknown';
                        flowRunCounts.set(name, (flowRunCounts.get(name) ?? 0) + 1);
                        flowTokenCounts.set(name, (flowTokenCounts.get(name) ?? 0) + sessionTokens);
                        flowPromptMap.set(name, (flowPromptMap.get(name) ?? 0) + (tok?.prompt ?? 0));
                        flowCompletMap.set(name, (flowCompletMap.get(name) ?? 0) + (tok?.completion ?? 0));
                        if (!flowIdMap.has(name)) flowIdMap.set(name, s.graph_id);

                        if (s.finished_at && s.created_at) {
                            const dur = new Date(s.finished_at).getTime() - new Date(s.created_at).getTime();
                            if (dur > 0) {
                                totalDurationMs += dur;
                                endedWithDuration++;
                            }
                        }
                    }

                    const endedCount = statusCounts[GraphSessionStatus.ENDED] ?? 0;
                    const successRate = sessions.length > 0 ? Math.round((endedCount / sessions.length) * 100) : 0;

                    // ── build top flows ───────────────────────────────────────────
                    const topFlows: TopFlowItem[] = Array.from(flowRunCounts.entries())
                        .map(([name, count]) => {
                            const graphId = flowIdMap.get(name) ?? 0;
                            const modelName = resolveModelName(graphId);
                            const prompt = flowPromptMap.get(name) ?? 0;
                            const compl = flowCompletMap.get(name) ?? 0;
                            const cost = calcCost(prompt, compl, modelName);
                            totalCost += cost;
                            return {
                                graphId,
                                name,
                                count,
                                tokens: flowTokenCounts.get(name) ?? 0,
                                modelName,
                                cost,
                            };
                        })
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 8);

                    const activeSessions: ActiveSessionItem[] = sessions
                        .filter((s) => ACTIVE_STATUSES.has(s.status))
                        .map((s) => ({
                            id: s.id,
                            graphId: s.graph_id,
                            flowName: s.graph_name || 'Unknown',
                            status: s.status,
                            createdAt: s.created_at,
                        }));

                    return {
                        totalFlows: flowsLight.length,
                        flowsWithSubflows: flowsLight.filter((f) => f.subflows && f.subflows.length > 0).length,
                        totalAgents: agents.length,
                        totalTools: tools.length,
                        totalSessions: sessions.length,
                        sessionsToday,
                        successRate,
                        totalTokens,
                        totalCost,
                        statusCounts,
                        topFlows,
                        avgSessionDurationMs:
                            endedWithDuration > 0 ? Math.round(totalDurationMs / endedWithDuration) : 0,
                        activeSessions,
                    };
                }
            )
        );
    }
}
