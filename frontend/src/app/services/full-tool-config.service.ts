import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, forkJoin, of, map, switchMap } from 'rxjs';
import { Tool } from '../features/tools/models/tool.model';
import { BuiltinToolsService } from '../features/tools/services/builtin-tools/builtin-tools.service';
import { ToolConfigService } from '../features/tools/services/builtin-tools/tool-config.service';
import {
  CreateToolConfigRequest,
  GetToolConfigRequest,
  ToolConfig,
} from '../features/tools/models/tool-config.model';

export interface FullToolConfig extends Tool {
  toolConfigs: GetToolConfigRequest[];
}

@Injectable({
  providedIn: 'root',
})
export class FullToolConfigService {
  constructor(
    private toolService: BuiltinToolsService,
    private toolConfigService: ToolConfigService
  ) {}

  getFullToolConfigs(): Observable<FullToolConfig[]> {
    return forkJoin({
      tools: this.toolService.getTools(),
      toolConfigs: this.toolConfigService.getToolConfigs(),
    }).pipe(
      switchMap(
        ({
          tools,
          toolConfigs,
        }: { tools: Tool[]; toolConfigs: GetToolConfigRequest[] }) => {
        const enabledTools = tools.filter((tool: Tool) => tool.enabled === true);

        const toolsNeedingConfigs = enabledTools.filter(
          (tool: Tool) =>
            tool.tool_fields.length === 0 &&
            !toolConfigs.some((config: GetToolConfigRequest) => config.tool === tool.id)
        );

        if (toolsNeedingConfigs.length === 0) {
          const updatedTools = enabledTools.map((tool: Tool) => {
            const relatedToolConfigs = toolConfigs.filter(
              (config: GetToolConfigRequest) => config.tool === tool.id
            );

            const updatedTool: FullToolConfig = {
              ...tool,
              toolConfigs: [...relatedToolConfigs],
            };

            return updatedTool;
          });

          return of(updatedTools);
        }

        const toolConfigCreationRequests = toolsNeedingConfigs.map((tool: Tool) =>
          this.createToolConfigForTool(tool)
        );

        return forkJoin(toolConfigCreationRequests).pipe(
          map((createdConfigs) => {
            const updatedTools = enabledTools.map((tool: Tool) => {
              const relatedToolConfigs = toolConfigs.filter(
                (config: GetToolConfigRequest) => config.tool === tool.id
              );

              const newToolConfigs = createdConfigs.filter(
                (newConfig: GetToolConfigRequest) => newConfig.tool === tool.id
              );

              const updatedTool: FullToolConfig = {
                ...tool,
                toolConfigs: [...relatedToolConfigs, ...newToolConfigs],
              };

              return updatedTool;
            });

            return updatedTools;
          })
        );
      })
    );
  }

  private createToolConfigForTool(
    tool: Tool
  ): Observable<GetToolConfigRequest> {
    const createConfig: CreateToolConfigRequest = {
      name: `${tool.name}`,
      configuration: {},
      tool: tool.id,
    };

    return this.toolConfigService.createToolConfig(createConfig).pipe(
      map((response: ToolConfig) => {
        return response;
      })
    );
  }
}
