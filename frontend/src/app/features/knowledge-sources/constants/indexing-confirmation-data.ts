import { ConfirmationDialogData } from '@shared/components';

export const INDEXING_CONFIRMATION_DATA: ConfirmationDialogData = {
    title: 'Confirm Indexing',
    message:
        'Initializing indexing for <strong>n</strong> files. This process involves document parsing, chunking, and generating vector embeddings via <strong>LLM services</strong>.',
    caution:
        "This operation consumes <strong>tokens</strong> based on your provider's plan. Processing time varies from <strong>seconds</strong> to <strong>hours</strong> depending on data volume.",
    type: 'warning',
    cancelText: 'Later',
    confirmText: 'Start Indexing',
};
