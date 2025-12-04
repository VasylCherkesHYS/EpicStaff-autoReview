import { Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AgentsService } from './staff.service';
import { LLM_Config_Service } from '../features/settings-dialog/services/llms/LLM_config.service';
import { ToolConfigService } from '../features/tools/services/builtin-tools/tool-config.service';
import { PythonCodeToolService } from '../user-settings-page/tools/custom-tool-editor/services/pythonCodeToolService.service';
import { PythonCodeToolConfigService } from '../features/tools/services/custom-tools/python-code-tool-config.service';
import { LLM_Models_Service } from '../features/settings-dialog/services/llms/LLM_models.service';
import { ProjectsStorageService } from '../features/projects/services/projects-storage.service';
import { LLM_Providers_Service } from '../features/settings-dialog/services/LLM_providers.service';
import { BuiltinToolsService } from '../features/tools/services/builtin-tools/builtin-tools.service';
import { McpToolsService } from '../features/tools/services/mcp-tools/mcp-tools.service';

import { GetAgentRequest, PartialUpdateAgentRequest } from '../shared/models/agent.model';
import { GetToolConfigRequest, PythonCodeToolConfig } from '../features/tools/models/tool_config.model';
import { GetPythonCodeToolRequest } from '../features/tools/models/python-code-tool.model';
import { GetMcpToolRequest } from '../features/tools/models/mcp-tool.model';
import { RealtimeModelConfigsService } from '../features/settings-dialog/services/realtime-llms/real-time-model-config.service';
import { RealtimeModelsService } from '../features/settings-dialog/services/realtime-llms/real-time-models.service';
import { LLM_Provider } from '../features/settings-dialog/models/LLM_provider.model';
import { FullLLMConfig } from '../features/settings-dialog/services/llms/full-llm-config.service';
import { FullRealtimeConfig } from '../features/settings-dialog/services/realtime-llms/full-reamtime-config.service';
import { Tool } from '../features/tools/models/tool.model';

export interface MergedConfig {
  id: number;
  custom_name: string;
  model_name: string;
  type: 'llm' | 'realtime'; 
  provider_id?: number;
  provider_name?: string;
}

export interface PartialAgent extends Partial<PartialUpdateAgentRequest> {
  fullLlmConfig?: FullLLMConfig | null;
  fullFcmLlmConfig?: FullLLMConfig | null;
  fullRealtimeConfig?: FullRealtimeConfig | null;
  fullConfiguredTools?: GetToolConfigRequest[];
  fullPythonTools?: GetPythonCodeToolRequest[];
  fullPythonToolConfigs?: PythonCodeToolConfig[];
  fullMcpTools?: GetMcpToolRequest[];
  mergedTools?: {
    id: number;
    configName: string;
    toolName: string;
    type: string;
  }[];
  mergedConfigs?: MergedConfig[];
  tags?: string[];
}


export interface FullAgent extends GetAgentRequest {
  fullLlmConfig?: FullLLMConfig | null;
  fullFcmLlmConfig?: FullLLMConfig | null;
  fullRealtimeConfig?: FullRealtimeConfig | null;
  fullConfiguredTools: GetToolConfigRequest[];
  fullPythonTools: GetPythonCodeToolRequest[];
  fullPythonToolConfigs: PythonCodeToolConfig[];
  fullMcpTools: GetMcpToolRequest[];
  mergedTools: {
    id: number;
    configName: string;
    toolName: string;
    type: string;
  }[];
  mergedConfigs: MergedConfig[];
  tags: string[];
}

export interface TableFullAgent extends Omit<FullAgent, 'id'> {
  id: number | string;
}

@Injectable({
  providedIn: 'root',
})
export class FullAgentService {
  constructor(
    private agentsService: AgentsService,
    private llmConfigService: LLM_Config_Service,
    private toolConfigService: ToolConfigService,
    private pythonCodeToolService: PythonCodeToolService,
    private pythonCodeToolConfigService: PythonCodeToolConfigService,
    private llmModelsService: LLM_Models_Service,
    private projectsService: ProjectsStorageService,
    private realtimeModelConfigsService: RealtimeModelConfigsService,
    private realtimeModelsService: RealtimeModelsService,
    private llmProvidersService: LLM_Providers_Service,
    private toolService: BuiltinToolsService,
    private mcpToolsService: McpToolsService
  ) {}

  getFullAgents(): Observable<FullAgent[]> {
    return forkJoin({
      agents: this.agentsService.getAgents(),
      llmConfigs: this.llmConfigService.getAllConfigsLLM(),
      toolConfigs: this.toolConfigService.getToolConfigs(),
      pythonTools: this.pythonCodeToolService.getPythonCodeTools(),
      pythonToolConfigs: this.pythonCodeToolConfigService.getConfigs(),
      mcpTools: this.mcpToolsService.getMcpTools(),
      llmModels: this.llmModelsService.getLLMModels(),
      realtimeConfigs: this.realtimeModelConfigsService.getAllConfigs(),
      realtimeModels: this.realtimeModelsService.getAllModels(),
      llmProviders: this.llmProvidersService.getProviders(),
      tools: this.toolService.getTools(),
    }).pipe(
      map(
        ({
          agents,
          llmConfigs,
          toolConfigs,
          pythonTools,
          pythonToolConfigs,
          mcpTools,
          llmModels,
          realtimeConfigs,
          realtimeModels,
          llmProviders,
          tools,
        }) => {
          // Build lookup tables for models and providers
          const modelMap: Record<number, any> = {};
          llmModels.forEach((model) => {
            modelMap[model.id] = model;
          });

          const realtimeModelMap: Record<number, any> = {};
          realtimeModels.forEach((model) => {
            realtimeModelMap[model.id] = model;
          });

          const providerMap: Record<number, LLM_Provider> = {};
          llmProviders.forEach((provider) => {
            providerMap[provider.id] = provider;
          });

          return agents.map((agent) => {
            const findEnhancedLlmConfig = (
              configId: number | null
            ): FullLLMConfig | null => {
              if (configId === null) return null;
              const config = llmConfigs.find((cfg) => cfg.id === configId);
              if (config) {
                const model = modelMap[config.model] || null;
                const provider = model?.llm_provider
                  ? providerMap[model.llm_provider]
                  : null;

                return {
                  ...config,
                  modelDetails: model,
                  providerDetails: provider,
                };
              }
              return null;
            };

            const findEnhancedRealtimeConfig = (
              configId: number | null
            ): FullRealtimeConfig | null => {
              if (configId === null) return null;
              const config = realtimeConfigs.find((cfg) => cfg.id === configId);
              if (config) {
                const model = realtimeModelMap[config.realtime_model] || null;
                const provider = model?.provider
                  ? providerMap[model.provider]
                  : null;

                return {
                  ...config,
                  modelDetails: model,
                  providerDetails: provider,
                };
              }
              return null;
            };

            // Use the helper functions, ensuring they don't receive `null`
            const fullLlmConfig = findEnhancedLlmConfig(agent.llm_config);
            const fullFcmLlmConfig = findEnhancedLlmConfig(
              agent.fcm_llm_config
            );
            const fullRealtimeConfig = findEnhancedRealtimeConfig(
              agent.realtime_agent?.realtime_config
            );

            // Parse tools from the unified tools array
            const configuredToolIds: number[] = [];
            const pythonToolIds: number[] = [];
            const pythonToolConfigIds: number[] = [];
            const mcpToolIds: number[] = [];

            if (agent.tools && Array.isArray(agent.tools)) {
              agent.tools.forEach((tool) => {
                if (tool.unique_name.startsWith('configured-tool:')) {
                  configuredToolIds.push(tool.data.id);
                } else if (tool.unique_name.startsWith('python-code-tool-config:')) {
                  pythonToolConfigIds.push(tool.data.id);
                } else if (tool.unique_name.startsWith('python-code-tool:')) {
                  pythonToolIds.push(tool.data.id);
                } else if (tool.unique_name.startsWith('mcp-tool:')) {
                  mcpToolIds.push(tool.data.id);
                }
              });
            }

            // Tool configs based on parsed IDs
            const fullConfiguredTools = toolConfigs.filter((tool) =>
              configuredToolIds.includes(tool.id)
            );
            const fullPythonTools = pythonTools.filter((pt) =>
              pythonToolIds.includes(pt.id)
            );
            const fullPythonToolConfigs = pythonToolConfigs.filter((ptc) =>
              pythonToolConfigIds.includes(ptc.id)
            );
            const fullMcpTools = mcpTools.filter((mcp: GetMcpToolRequest) =>
              mcpToolIds.includes(mcp.id)
            );

            const toolsMap = new Map<number, string>();
            tools.forEach((tool: Tool) => {
              toolsMap.set(tool.id, tool.name);
            });

            // Build python tools map for config names
            const pythonToolsMap = new Map<number, string>();
            pythonTools.forEach((pt) => {
              pythonToolsMap.set(pt.id, pt.name);
            });

            // Merge all sets of tools
            const mergedTools = [
              ...fullConfiguredTools.map((tc) => ({
                id: tc.id,
                configName: tc.name,
                toolName: toolsMap.get(tc.tool) || 'Unknown Tool',
                type: 'tool-config',
              })),
              ...fullPythonTools.map((pt) => ({
                id: pt.id,
                configName: pt.name,
                toolName: pt.name,
                type: 'python-tool',
              })),
              ...fullPythonToolConfigs.map((ptc) => ({
                id: ptc.id,
                configName: ptc.name,
                toolName: pythonToolsMap.get(ptc.tool) || 'Unknown Tool',
                type: 'python-tool-config',
              })),
              ...fullMcpTools.map((mcp: GetMcpToolRequest) => ({
                id: mcp.id,
                configName: mcp.name,
                toolName: mcp.tool_name,
                type: 'mcp-tool',
              })),
            ];

            // Merge LLM and realtime configs
            const mergedConfigs: MergedConfig[] = [];

            if (fullLlmConfig) {
              mergedConfigs.push({
                id: fullLlmConfig.id,
                custom_name: fullLlmConfig.custom_name,
                model_name: fullLlmConfig.modelDetails?.name || 'Unknown Model',
                type: 'llm',
                provider_id: fullLlmConfig.modelDetails?.llm_provider,
                provider_name:
                  fullLlmConfig.providerDetails?.name || 'Unknown Provider',
              });
            }

            if (fullRealtimeConfig) {
              mergedConfigs.push({
                id: fullRealtimeConfig.id,
                custom_name: fullRealtimeConfig.custom_name,
                model_name:
                  fullRealtimeConfig.modelDetails?.name || 'Unknown Model',
                type: 'realtime',
                provider_id: fullRealtimeConfig.modelDetails?.provider,
                provider_name:
                  fullRealtimeConfig.providerDetails?.name ||
                  'Unknown Provider',
              });
            }

            return {
              ...agent,
              configured_tools: configuredToolIds,
              python_code_tools: pythonToolIds,
              python_code_tool_configs: pythonToolConfigIds,
              mcp_tools: mcpToolIds,
              fullLlmConfig,
              fullFcmLlmConfig,
              fullRealtimeConfig,
              fullConfiguredTools,
              fullPythonTools,
              fullPythonToolConfigs,
              fullMcpTools,
              mergedTools,
              mergedConfigs,
              tags: [],
            };
          });
        }
      )
    );
  }

  getFullAgentsByProject(projectId: number): Observable<FullAgent[]> {
    return forkJoin({
      project: this.projectsService.getProjectById(projectId),
      agents: this.agentsService.getAgentsByProjectId(projectId),
      llmConfigs: this.llmConfigService.getAllConfigsLLM(),
      toolConfigs: this.toolConfigService.getToolConfigs(),
      pythonTools: this.pythonCodeToolService.getPythonCodeTools(),
      pythonToolConfigs: this.pythonCodeToolConfigService.getConfigs(),
      mcpTools: this.mcpToolsService.getMcpTools(),
      llmModels: this.llmModelsService.getLLMModels(),
      realtimeConfigs: this.realtimeModelConfigsService.getAllConfigs(),
      realtimeModels: this.realtimeModelsService.getAllModels(),
      llmProviders: this.llmProvidersService.getProviders(),
      tools: this.toolService.getTools(),
    }).pipe(
      map(
        ({
          project,
          agents,
          llmConfigs,
          toolConfigs,
          pythonTools,
          pythonToolConfigs,
          mcpTools,
          llmModels,
          realtimeConfigs,
          realtimeModels,
          llmProviders,
          tools,
        }) => {
          // Build lookup tables for models and providers
          const modelMap: Record<number, any> = {};
          llmModels.forEach((model) => {
            modelMap[model.id] = model;
          });

          const realtimeModelMap: Record<number, any> = {};
          realtimeModels.forEach((model) => {
            realtimeModelMap[model.id] = model;
          });

          const providerMap: Record<number, LLM_Provider> = {};
          llmProviders.forEach((provider) => {
            providerMap[provider.id] = provider;
          });

          // Filter agents to include only those related to the project
          const projectAgentIds = project?.agents || []; // Agents field from the project

          const filteredAgents = agents.filter(
            (agent) => projectAgentIds.includes(agent.id) // Keep only agents present in the project
          );

          return filteredAgents.map((agent) => {
            const findEnhancedLlmConfig = (
              configId: number | null
            ): FullLLMConfig | null => {
              if (configId === null) return null;
              const config = llmConfigs.find((cfg) => cfg.id === configId);
              if (config) {
                const model = modelMap[config.model] || null;
                const provider = model?.llm_provider
                  ? providerMap[model.llm_provider]
                  : null;

                return {
                  ...config,
                  modelDetails: model,
                  providerDetails: provider,
                };
              }
              return null;
            };

            const findEnhancedRealtimeConfig = (
              configId: number | null
            ): FullRealtimeConfig | null => {
              if (configId === null) return null;
              const config = realtimeConfigs.find((cfg) => cfg.id === configId);
              if (config) {
                const model = realtimeModelMap[config.realtime_model] || null;
                const provider = model?.provider
                  ? providerMap[model.provider]
                  : null;

                return {
                  ...config,
                  modelDetails: model,
                  providerDetails: provider,
                };
              }
              return null;
            };

            // Use the helper functions
            const fullLlmConfig = findEnhancedLlmConfig(agent.llm_config);
            const fullFcmLlmConfig = findEnhancedLlmConfig(
              agent.fcm_llm_config
            );
            const fullRealtimeConfig = findEnhancedRealtimeConfig(
              agent.realtime_agent?.realtime_config
            );

            // Parse tools from the unified tools array
            const configuredToolIds: number[] = [];
            const pythonToolIds: number[] = [];
            const pythonToolConfigIds: number[] = [];
            const mcpToolIds: number[] = [];

            if (agent.tools && Array.isArray(agent.tools)) {
              agent.tools.forEach((tool) => {
                if (tool.unique_name.startsWith('configured-tool:')) {
                  configuredToolIds.push(tool.data.id);
                } else if (tool.unique_name.startsWith('python-code-tool-config:')) {
                  pythonToolConfigIds.push(tool.data.id);
                } else if (tool.unique_name.startsWith('python-code-tool:')) {
                  pythonToolIds.push(tool.data.id);
                } else if (tool.unique_name.startsWith('mcp-tool:')) {
                  mcpToolIds.push(tool.data.id);
                }
              });
            }

            // Tool configs based on parsed IDs
            const fullConfiguredTools = toolConfigs.filter((tool) =>
              configuredToolIds.includes(tool.id)
            );
            const fullPythonTools = pythonTools.filter((pt) =>
              pythonToolIds.includes(pt.id)
            );
            const fullPythonToolConfigs = pythonToolConfigs.filter((ptc) =>
              pythonToolConfigIds.includes(ptc.id)
            );
            const fullMcpTools = mcpTools.filter((mcp: GetMcpToolRequest) =>
              mcpToolIds.includes(mcp.id)
            );

            const toolsMap = new Map<number, string>();
            tools.forEach((tool: Tool) => {
              toolsMap.set(tool.id, tool.name);
            });

            const pythonToolsMap = new Map<number, string>();
            pythonTools.forEach((pt) => {
              pythonToolsMap.set(pt.id, pt.name);
            });

            // Merge all sets of tools
            const mergedTools = [
              ...fullConfiguredTools.map((tc) => ({
                id: tc.id,
                configName: tc.name,
                toolName: toolsMap.get(tc.tool) || 'Unknown Tool',
                type: 'tool-config',
              })),
              ...fullPythonTools.map((pt) => ({
                id: pt.id,
                configName: pt.name,
                toolName: pt.name,
                type: 'python-tool',
              })),
              ...fullPythonToolConfigs.map((ptc) => ({
                id: ptc.id,
                configName: ptc.name,
                toolName: pythonToolsMap.get(ptc.tool) || 'Unknown Tool',
                type: 'python-tool-config',
              })),
              ...fullMcpTools.map((mcp: GetMcpToolRequest) => ({
                id: mcp.id,
                configName: mcp.name,
                toolName: mcp.tool_name,
                type: 'mcp-tool',
              })),
            ];

            const mergedConfigs: MergedConfig[] = [];

            if (fullLlmConfig) {
              mergedConfigs.push({
                id: fullLlmConfig.id,
                custom_name: fullLlmConfig.custom_name,
                model_name: fullLlmConfig.modelDetails?.name || 'Unknown Model',
                type: 'llm',
                provider_id: fullLlmConfig.modelDetails?.llm_provider,
                provider_name:
                  fullLlmConfig.providerDetails?.name || 'Unknown Provider',
              });
            }

            if (fullRealtimeConfig) {
              mergedConfigs.push({
                id: fullRealtimeConfig.id,
                custom_name: fullRealtimeConfig.custom_name,
                model_name:
                  fullRealtimeConfig.modelDetails?.name || 'Unknown Model',
                type: 'realtime',
                provider_id: fullRealtimeConfig.modelDetails?.provider,
                provider_name:
                  fullRealtimeConfig.providerDetails?.name ||
                  'Unknown Provider',
              });
            }

            return {
              ...agent,
              configured_tools: configuredToolIds,
              python_code_tools: pythonToolIds,
              python_code_tool_configs: pythonToolConfigIds,
              mcp_tools: mcpToolIds,
              fullLlmConfig,
              fullFcmLlmConfig,
              fullRealtimeConfig,
              fullConfiguredTools,
              fullPythonTools,
              fullPythonToolConfigs,
              fullMcpTools,
              mergedTools,
              mergedConfigs,
              tags: [],
            };
          });
        }
      )
    );
  }

  getFullAgentById(agentId: number): Observable<FullAgent | null> {
    return forkJoin({
      agents: this.agentsService.getAgents(),
      llmConfigs: this.llmConfigService.getAllConfigsLLM(),
      toolConfigs: this.toolConfigService.getToolConfigs(),
      pythonTools: this.pythonCodeToolService.getPythonCodeTools(),
      pythonToolConfigs: this.pythonCodeToolConfigService.getConfigs(),
      mcpTools: this.mcpToolsService.getMcpTools(),
      llmModels: this.llmModelsService.getLLMModels(),
      realtimeConfigs: this.realtimeModelConfigsService.getAllConfigs(),
      realtimeModels: this.realtimeModelsService.getAllModels(),
      llmProviders: this.llmProvidersService.getProviders(),
      tools: this.toolService.getTools(),
    }).pipe(
      map(
        ({
          agents,
          llmConfigs,
          toolConfigs,
          pythonTools,
          pythonToolConfigs,
          mcpTools,
          llmModels,
          realtimeConfigs,
          realtimeModels,
          llmProviders,
          tools,
        }) => {
          // Find the agent with the specified ID
          const agent = agents.find((agent) => agent.id === agentId);

          // If no agent is found, return null
          if (!agent) {
            return null;
          }

          // Build lookup tables for models and providers
          const modelMap: Record<number, any> = {};
          llmModels.forEach((model) => {
            modelMap[model.id] = model;
          });

          const realtimeModelMap: Record<number, any> = {};
          realtimeModels.forEach((model) => {
            realtimeModelMap[model.id] = model;
          });

          const providerMap: Record<number, LLM_Provider> = {};
          llmProviders.forEach((provider) => {
            providerMap[provider.id] = provider;
          });

          const findEnhancedLlmConfig = (
            configId: number | null
          ): FullLLMConfig | null => {
            if (configId === null) return null;
            const config = llmConfigs.find((cfg) => cfg.id === configId);
            if (config) {
              const model = modelMap[config.model] || null;
              const provider = model?.llm_provider
                ? providerMap[model.llm_provider]
                : null;

              return {
                ...config,
                modelDetails: model,
                providerDetails: provider,
              };
            }
            return null;
          };

          const findEnhancedRealtimeConfig = (
            configId: number | null
          ): FullRealtimeConfig | null => {
            if (configId === null) return null;
            const config = realtimeConfigs.find((cfg) => cfg.id === configId);
            if (config) {
              const model = realtimeModelMap[config.realtime_model] || null;
              const provider = model?.provider
                ? providerMap[model.provider]
                : null;

              return {
                ...config,
                modelDetails: model,
                providerDetails: provider,
              };
            }
            return null;
          };

          // Use the helper functions
          const fullLlmConfig = findEnhancedLlmConfig(agent.llm_config);
          const fullFcmLlmConfig = findEnhancedLlmConfig(agent.fcm_llm_config);
          const fullRealtimeConfig = findEnhancedRealtimeConfig(
            agent.realtime_agent?.realtime_config
          );

          // Parse tools from the unified tools array
          const configuredToolIds: number[] = [];
          const pythonToolIds: number[] = [];
          const pythonToolConfigIds: number[] = [];
          const mcpToolIds: number[] = [];

          if (agent.tools && Array.isArray(agent.tools)) {
            agent.tools.forEach((tool) => {
              if (tool.unique_name.startsWith('configured-tool:')) {
                configuredToolIds.push(tool.data.id);
              } else if (tool.unique_name.startsWith('python-code-tool-config:')) {
                pythonToolConfigIds.push(tool.data.id);
              } else if (tool.unique_name.startsWith('python-code-tool:')) {
                pythonToolIds.push(tool.data.id);
              } else if (tool.unique_name.startsWith('mcp-tool:')) {
                mcpToolIds.push(tool.data.id);
              }
            });
          }

          // Tool configs based on parsed IDs
          const fullConfiguredTools = toolConfigs.filter((tool) =>
            configuredToolIds.includes(tool.id)
          );
          const fullPythonTools = pythonTools.filter((pt) =>
            pythonToolIds.includes(pt.id)
          );
          const fullPythonToolConfigs = pythonToolConfigs.filter((ptc) =>
            pythonToolConfigIds.includes(ptc.id)
          );
          const fullMcpTools = mcpTools.filter((mcp: GetMcpToolRequest) =>
            mcpToolIds.includes(mcp.id)
          );

          const toolsMap = new Map<number, string>();
          tools.forEach((tool: Tool) => {
            toolsMap.set(tool.id, tool.name);
          });

          const pythonToolsMap = new Map<number, string>();
          pythonTools.forEach((pt) => {
            pythonToolsMap.set(pt.id, pt.name);
          });

          // Merge all sets of tools
          const mergedTools = [
            ...fullConfiguredTools.map((tc) => ({
              id: tc.id,
              configName: tc.name,
              toolName: toolsMap.get(tc.tool) || 'Unknown Tool',
              type: 'tool-config',
            })),
            ...fullPythonTools.map((pt) => ({
              id: pt.id,
              configName: pt.name,
              toolName: pt.name,
              type: 'python-tool',
            })),
            ...fullPythonToolConfigs.map((ptc) => ({
              id: ptc.id,
              configName: ptc.name,
              toolName: pythonToolsMap.get(ptc.tool) || 'Unknown Tool',
              type: 'python-tool-config',
            })),
            ...fullMcpTools.map((mcp: GetMcpToolRequest) => ({
              id: mcp.id,
              configName: mcp.name,
              toolName: mcp.tool_name,
              type: 'mcp-tool',
            })),
          ];

          const mergedConfigs: MergedConfig[] = [];

          if (fullLlmConfig) {
            mergedConfigs.push({
              id: fullLlmConfig.id,
              custom_name: fullLlmConfig.custom_name,
              model_name: fullLlmConfig.modelDetails?.name || 'Unknown Model',
              type: 'llm',
              provider_id: fullLlmConfig.modelDetails?.llm_provider,
              provider_name:
                fullLlmConfig.providerDetails?.name || 'Unknown Provider',
            });
          }

          if (fullRealtimeConfig) {
            mergedConfigs.push({
              id: fullRealtimeConfig.id,
              custom_name: fullRealtimeConfig.custom_name,
              model_name:
                fullRealtimeConfig.modelDetails?.name || 'Unknown Model',
              type: 'realtime',
              provider_id: fullRealtimeConfig.modelDetails?.provider,
              provider_name:
                fullRealtimeConfig.providerDetails?.name || 'Unknown Provider',
            });
          }

          return {
            ...agent,
            configured_tools: configuredToolIds,
            python_code_tools: pythonToolIds,
            python_code_tool_configs: pythonToolConfigIds,
            mcp_tools: mcpToolIds,
            fullLlmConfig,
            fullFcmLlmConfig,
            fullRealtimeConfig,
            fullConfiguredTools,
            fullPythonTools,
            fullPythonToolConfigs,
            fullMcpTools,
            mergedTools,
            mergedConfigs,
            tags: [],
          };
        }
      )
    );
  }
}
