import { ToolUniqueName } from '../models/agent.model';

export function buildToolIdsArray(
  configuredToolIds: number[],
  pythonToolIds: number[],
  mcpToolIds: number[] = [],
  pythonToolConfigIds: number[] = []
): ToolUniqueName[] {
  const toolIds: ToolUniqueName[] = [];

  configuredToolIds.forEach((id) => {
    toolIds.push(`configured-tool:${id}`);
  });

  pythonToolIds.forEach((id) => {
    toolIds.push(`python-code-tool:${id}`);
  });

  pythonToolConfigIds.forEach((id) => {
    toolIds.push(`python-code-tool-config:${id}`);
  });

  mcpToolIds.forEach((id) => {
    toolIds.push(`mcp-tool:${id}`);
  });

  return toolIds;
}
