export interface ToolConfig {
  id: number;
  name: string;
  configuration: Record<string, any>;
  tool: number;
  is_completed: boolean;
  toolName?: string;
  toolDescription?: string;
}

export interface GetToolConfigRequest {
  id: number;
  name: string;
  configuration: Record<string, any>;
  tool: number;
  is_completed: boolean;
}

export interface CreateToolConfigRequest {
  name: string;
  configuration: Record<string, any>;
  tool: number;
}

export interface PythonCodeToolConfig {
  id: number;
  name: string;
  tool: number;
  configuration: Record<string, any>;
}

export interface CreatePythonCodeToolConfigRequest {
  name: string;
  tool: number;
  configuration: Record<string, any>;
}

export interface UpdatePythonCodeToolConfigRequest {
  name: string;
  tool: number;
  configuration: Record<string, any>;
}
