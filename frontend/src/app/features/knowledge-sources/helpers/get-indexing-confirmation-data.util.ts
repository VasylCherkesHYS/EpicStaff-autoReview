import { ConfirmationDialogData } from '@shared/components';

export function getIndexingConfirmationData(fileCount?: number): ConfirmationDialogData {
    const filesText = fileCount != null ? ` for <strong>${fileCount}</strong> file(s)` : '';

    return {
        title: 'Confirm Indexing',
        message: `Initializing indexing${filesText}. This process involves document parsing, chunking, and generating vector embeddings via <strong>LLM services</strong>.`,
        caution:
            "This operation consumes <strong>tokens</strong> based on your provider's plan. Processing time varies from <strong>seconds</strong> to <strong>hours</strong> depending on data volume.",
        type: 'warning',
        cancelText: 'Later',
        confirmText: 'Start Indexing',
    };
}

export function getReindexingConfirmationData(fileNames: string[]): ConfirmationDialogData {
    const fileListHtml = fileNames.map((name) => `<li>• ${name}</li>`).join('');

    return {
        title: 'Confirm Re-indexing',
        message:
            "This operation consumes <strong>tokens</strong> based on your provider's plan. Processing time varies from <strong>seconds</strong> to <strong>hours</strong> depending on data volume.",
        caution: `<details><summary>You are about to re-index <strong>${fileNames.length}</strong> file(s)</summary> \n
                      <ul>${fileListHtml}</ul></details>`,
        type: 'warning',
        cancelText: 'Cancel',
        confirmText: 'Re-index',
    };
}
