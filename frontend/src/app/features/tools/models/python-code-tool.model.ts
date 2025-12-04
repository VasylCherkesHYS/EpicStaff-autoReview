import {
  GetPythonCodeRequest,
  CreatePythonCodeRequest,
  UpdatePythonCodeRequest,
} from './python-code.model';

export interface ArgsSchema {
  $schema?: string;
  title: string;
  type: string;
  properties: {
    [key: string]: {
      type: string;
      description?: string;
      required?: boolean;
    };
  };
  required?: string[];
}

export type ToolConfigFieldType =
  | 'llm_config'
  | 'embedding_config'
  | 'string'
  | 'boolean'
  | 'any'
  | 'integer'
  | 'float';

export interface PythonCodeToolConfigField {
  id: number;
  name: string;
  tool: number;
  description: string;
  data_type: ToolConfigFieldType;
  required: boolean;
  secret: boolean;
}

export interface GetPythonCodeToolRequest {
  id: number;
  python_code: GetPythonCodeRequest;
  name: string;
  description: string;
  args_schema: ArgsSchema;
  built_in: boolean;
  tool_fields: PythonCodeToolConfigField[];
}
export interface CreatePythonCodeToolRequest {
  python_code: CreatePythonCodeRequest;
  name: string;
  description: string;
  args_schema: ArgsSchema;
}

export interface UpdatePythonCodeToolRequest {
  id: number;
  python_code: UpdatePythonCodeRequest;
  name: string; // Required, minLength: 1
  description: string;
  args_schema: ArgsSchema; // Now an object rather than a JSON string
}
