import { Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { TasksService } from './tasks.service';
import { AgentsService } from './staff.service';
import { ToolConfigService } from '../features/tools/services/builtin-tools/tool-config.service';
import { PythonCodeToolService } from '../user-settings-page/tools/custom-tool-editor/services/pythonCodeToolService.service';
import { PythonCodeToolConfigService } from '../features/tools/services/custom-tools/python-code-tool-config.service';
import { BuiltinToolsService } from '../features/tools/services/builtin-tools/builtin-tools.service';
import { McpToolsService } from '../features/tools/services/mcp-tools/mcp-tools.service';
import { FullTask } from '../shared/models/full-task.model';
import { GetTaskRequest } from '../shared/models/task.model';
import { GetAgentRequest } from '../shared/models/agent.model';
import { GetToolConfigRequest, PythonCodeToolConfig } from '../features/tools/models/tool_config.model';
import { GetPythonCodeToolRequest } from '../features/tools/models/python-code-tool.model';
import { GetMcpToolRequest } from '../features/tools/models/mcp-tool.model';
import { Tool } from '../features/tools/models/tool.model';

export interface TableFullTask extends Omit<FullTask, 'id'> {
  id: number | string;
}

@Injectable({
  providedIn: 'root',
})
export class FullTaskService {
  constructor(
    private tasksService: TasksService,
    private agentsService: AgentsService,
    private toolConfigService: ToolConfigService,
    private pythonCodeToolService: PythonCodeToolService,
    private pythonCodeToolConfigService: PythonCodeToolConfigService,
    private toolsService: BuiltinToolsService,
    private mcpToolsService: McpToolsService
  ) {}

  getFullTasks(): Observable<FullTask[]> {
    return forkJoin({
      tasks: this.tasksService.getTasks(),
      agents: this.agentsService.getAgents(),
      toolConfigs: this.toolConfigService.getToolConfigs(),
      pythonTools: this.pythonCodeToolService.getPythonCodeTools(),
      pythonToolConfigs: this.pythonCodeToolConfigService.getConfigs(),
      mcpTools: this.mcpToolsService.getMcpTools(),
      tools: this.toolsService.getTools(),
    }).pipe(
      map(({ tasks, agents, toolConfigs, pythonTools, pythonToolConfigs, mcpTools, tools }) => {
        const agentMap = new Map<number, GetAgentRequest>();
        agents.forEach((agent) => {
          agentMap.set(agent.id, agent);
        });

        const toolsMap = new Map<number, string>();
        tools.forEach((tool: Tool) => {
          toolsMap.set(tool.id, tool.name);
        });

        const pythonToolsMap = new Map<number, string>();
        pythonTools.forEach((pt) => {
          pythonToolsMap.set(pt.id, pt.name);
        });

        return tasks.map((task) => {
          const agentData = task.agent
            ? agentMap.get(task.agent) || null
            : null;

          const configuredToolIds: number[] = [];
          const pythonToolIds: number[] = [];
          const pythonToolConfigIds: number[] = [];
          const mcpToolIds: number[] = [];

          task.tools.forEach((tool) => {
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

          return {
            ...task,
            agentData,
            mergedTools,
          };
        });
      })
    );
  }

  getFullTasksByProject(projectId: number): Observable<FullTask[]> {
    return forkJoin({
      tasks: this.tasksService.getTasksByProjectId(projectId.toString()),
      agents: this.agentsService.getAgents(),
      toolConfigs: this.toolConfigService.getToolConfigs(),
      pythonTools: this.pythonCodeToolService.getPythonCodeTools(),
      pythonToolConfigs: this.pythonCodeToolConfigService.getConfigs(),
      mcpTools: this.mcpToolsService.getMcpTools(),
      tools: this.toolsService.getTools(),
    }).pipe(
      map(({ tasks, agents, toolConfigs, pythonTools, pythonToolConfigs, mcpTools, tools }) => {
        const agentMap = new Map<number, GetAgentRequest>();
        agents.forEach((agent) => {
          agentMap.set(agent.id, agent);
        });

        const toolsMap = new Map<number, string>();
        tools.forEach((tool: Tool) => {
          toolsMap.set(tool.id, tool.name);
        });

        const pythonToolsMap = new Map<number, string>();
        pythonTools.forEach((pt) => {
          pythonToolsMap.set(pt.id, pt.name);
        });

        return tasks.map((task) => {
          const agentData = task.agent
            ? agentMap.get(task.agent) || null
            : null;

          const configuredToolIds: number[] = [];
          const pythonToolIds: number[] = [];
          const pythonToolConfigIds: number[] = [];
          const mcpToolIds: number[] = [];

          task.tools.forEach((tool) => {
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

          return {
            ...task,
            agentData,
            mergedTools,
          };
        });
      })
    );
  }

  getFullTaskById(taskId: number): Observable<FullTask | null> {
    return forkJoin({
      task: this.tasksService.getTaskById(taskId),
      agents: this.agentsService.getAgents(),
      toolConfigs: this.toolConfigService.getToolConfigs(),
      pythonTools: this.pythonCodeToolService.getPythonCodeTools(),
      pythonToolConfigs: this.pythonCodeToolConfigService.getConfigs(),
      mcpTools: this.mcpToolsService.getMcpTools(),
      tools: this.toolsService.getTools(),
    }).pipe(
      map(({ task, agents, toolConfigs, pythonTools, pythonToolConfigs, mcpTools, tools }) => {
        if (!task) {
          return null;
        }

        const agentMap = new Map<number, GetAgentRequest>();
        agents.forEach((agent) => {
          agentMap.set(agent.id, agent);
        });

        const toolsMap = new Map<number, string>();
        tools.forEach((tool: Tool) => {
          toolsMap.set(tool.id, tool.name);
        });

        const pythonToolsMap = new Map<number, string>();
        pythonTools.forEach((pt) => {
          pythonToolsMap.set(pt.id, pt.name);
        });

        const agentData = task.agent ? agentMap.get(task.agent) || null : null;

        const configuredToolIds: number[] = [];
        const pythonToolIds: number[] = [];
        const pythonToolConfigIds: number[] = [];
        const mcpToolIds: number[] = [];

        task.tools.forEach((tool) => {
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

        return {
          ...task,
          agentData,
          mergedTools,
        };
      })
    );
  }
}
