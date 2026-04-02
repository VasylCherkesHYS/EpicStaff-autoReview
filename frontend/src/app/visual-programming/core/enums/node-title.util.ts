import { GraphNoteModel, NodeModel, ProjectNodeModel, PythonNodeModel, SubGraphNodeModel } from '../models/node.model';
import { NodeType } from './node-type';

/** Strips the legacy auto-generated instance counter suffix, e.g. "Python-Node (#2)" → "Python-Node" */
function stripCounter(name: string | null | undefined): string {
    if (!name) return '';
    return name.replace(/\s*\(#\d+\)\s*$/, '').trim();
}

/** Returns "Base Name #N" where N is the nodeNumber, or just "Base Name" if no number. */
function withNumber(baseName: string, node: NodeModel): string {
    if (node.nodeNumber != null) {
        return `${baseName} #${node.nodeNumber}`;
    }
    return baseName;
}

export function getNodeTitle(node: NodeModel): string {
    if (!node) return 'Unknown Node';
    switch (node.type) {
        case NodeType.PROJECT:
            return withNumber(stripCounter((node as any).node_name), node);
        case NodeType.PYTHON:
            return withNumber(stripCounter((node as PythonNodeModel).node_name), node);
        case NodeType.TABLE:
            return withNumber(stripCounter((node as any).data.name), node);
        case NodeType.LLM:
            return withNumber(stripCounter((node as any).data.custom_name), node);
        case NodeType.START:
            return withNumber('Start', node);
        case NodeType.NOTE:
            return 'Note';
        case NodeType.FILE_EXTRACTOR:
            return withNumber(stripCounter(node.node_name), node);
        case NodeType.AUDIO_TO_TEXT:
            return withNumber(stripCounter((node as any).node_name), node);
        case NodeType.WEBHOOK_TRIGGER:
            return withNumber(stripCounter((node as any).node_name), node);
        case NodeType.TELEGRAM_TRIGGER:
            return withNumber(stripCounter((node as any).node_name), node);
        case NodeType.END:
            return withNumber('End', node);
        case NodeType.CODE_AGENT:
            return withNumber(stripCounter(node.node_name), node);
        case NodeType.SUBGRAPH:
            const subgraphNode = node as SubGraphNodeModel;
            if (subgraphNode.isBlocked || !subgraphNode.data?.name) {
                return 'Deleted Flow';
            }
            return withNumber(subgraphNode.data.name, node);
        default:
            return '';
    }
}
