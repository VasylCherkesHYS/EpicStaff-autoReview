import { CreatePythonCodeRequest, GetPythonCodeRequest, UpdatePythonCodeRequest } from './python-code.model';

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

export interface GetPythonCodeToolRequest {
    id: number;
    python_code: GetPythonCodeRequest;
    name: string;
    description: string;
    args_schema: ArgsSchema;
    built_in: boolean;
    use_storage?: boolean;
}
export interface CreatePythonCodeToolRequest {
    python_code: CreatePythonCodeRequest;
    name: string;
    description: string;
    args_schema: ArgsSchema;
    use_storage?: boolean;
}

export interface UpdatePythonCodeToolRequest {
    id: number;
    python_code: UpdatePythonCodeRequest;
    name: string; // Required, minLength: 1
    description: string;
    args_schema: ArgsSchema; // Now an object rather than a JSON string
    use_storage?: boolean;
}
