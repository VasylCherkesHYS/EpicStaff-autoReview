import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { expandCollapseAnimation } from '@shared/animations';

import { ToastService } from '../../../../../../services/notifications/toast.service';
import { AppSvgIconComponent } from '../../../../../../shared/components/app-svg-icon/app-svg-icon.component';
import {
    ExtractedChunk,
    ExtractedChunksMessageData,
    GraphMessage,
} from '../../../../models/graph-session-message.model';

@Component({
    selector: 'app-extracted-chunks-message',
    standalone: true,
    imports: [CommonModule, AppSvgIconComponent],
    templateUrl: './extracted-chunks-message.component.html',
    styleUrls: ['./extracted-chunks-message.component.scss'],
    animations: [expandCollapseAnimation],
})
export class ExtractedChunksMessageComponent {
    @Input() message!: GraphMessage;

    isExpanded = true;

    private readonly toastService = inject(ToastService);

    get data(): ExtractedChunksMessageData | null {
        if (this.message?.message_data?.message_type === 'extracted_chunks') {
            return this.message.message_data as ExtractedChunksMessageData;
        }
        return null;
    }

    trackByOrder(_index: number, chunk: ExtractedChunk): number {
        return chunk.chunk_order;
    }

    toggle(): void {
        this.isExpanded = !this.isExpanded;
    }

    copyChunkText(text: string, event: Event): void {
        event.stopPropagation();
        navigator.clipboard
            .writeText(text)
            .then(() => {
                this.toastService.success('Copied to clipboard!', 3000, 'bottom-right');
            })
            .catch(() => {
                this.toastService.error('Failed to copy', 3000, 'top-right');
            });
    }
}
