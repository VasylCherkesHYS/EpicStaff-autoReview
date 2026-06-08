import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';

import { ToastService } from '../../../../../../services/notifications/toast.service';
import { AppSvgIconComponent } from '../../../../../../shared/components/app-svg-icon/app-svg-icon.component';
import { GraphMessage, UpdateSessionStatusMessageData } from '../../../../models/graph-session-message.model';

@Component({
    selector: 'app-status-update-message',
    standalone: true,
    imports: [CommonModule, AppSvgIconComponent],
    template: `
        <div class="status-update-message">
            <div class="status-info">
                <span class="project-name">{{ projectName }}</span>
                <span class="status-value">Status: {{ status }}</span>
            </div>
            <div
                class="status-data"
                *ngIf="hasStatusData()"
            >
                <div class="status-data-label">
                    <app-svg-icon
                        icon="info-circle"
                        size="1rem"
                    />
                    Status Data:
                </div>
                <div class="status-data-wrapper">
                    <button
                        class="copy-btn"
                        (click)="copyStatusData($event)"
                        aria-label="Copy status data"
                    >
                        <app-svg-icon
                            icon="copy"
                            size="0.875rem"
                        />
                    </button>
                    <pre class="status-data-content">{{ statusData | json }}</pre>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .status-update-message {
                padding: 1rem;
                border: 1px solid var(--gray-750);
                border-radius: 8px;
                background-color: var(--gray-900);

                .status-info {
                    display: flex;
                    gap: 1rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.75rem;
                    .project-name {
                        color: var(--gray-500);
                    }
                    .status-value {
                        color: var(--gray-100);
                        font-weight: 500;
                    }
                }

                .status-data {
                    .status-data-label {
                        display: flex;
                        align-items: center;
                        font-weight: 500;
                        margin-bottom: 0.25rem;
                        color: var(--gray-400);
                        app-svg-icon {
                            margin-right: 0.5rem;
                        }
                    }
                    .status-data-wrapper {
                        position: relative;

                        &:hover .copy-btn {
                            opacity: 1;
                        }
                    }

                    .status-data-content {
                        background-color: var(--gray-800);
                        border-radius: 6px;
                        padding: 0.75rem;
                        font-family: 'Courier New', monospace;
                        font-size: 0.8rem;
                        overflow-x: auto;
                        color: var(--gray-200);
                    }
                }
            }

            .copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 28px;
                height: 28px;
                border: none;
                border-radius: 6px;
                background: transparent;
                color: var(--gray-500);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition:
                    opacity 0.15s ease,
                    color 0.15s ease,
                    background-color 0.15s ease;
                padding: 0;
                z-index: 1;

                &:hover {
                    background: rgba(255, 255, 255, 0.08);
                    color: var(--gray-100);
                }
            }
        `,
    ],
})
export class StatusUpdateMessageComponent {
    @Input() message!: GraphMessage;

    private readonly toastService = inject(ToastService);

    get updateStatusData(): UpdateSessionStatusMessageData | null {
        if (this.message.message_data && this.message.message_data.message_type === 'update_session_status') {
            return this.message.message_data as UpdateSessionStatusMessageData;
        }
        return null;
    }

    get status(): string {
        return this.updateStatusData ? this.updateStatusData.status : '';
    }

    get statusData(): Record<string, unknown> {
        return this.updateStatusData ? this.updateStatusData.status_data : {};
    }

    get projectName(): string {
        return this.updateStatusData ? `Project #${this.updateStatusData.crew_id}` : '';
    }

    hasStatusData(): boolean {
        return !!(this.statusData && Object.keys(this.statusData).length);
    }

    copyStatusData(event: Event): void {
        event.stopPropagation();
        navigator.clipboard
            .writeText(JSON.stringify(this.statusData, null, 2))
            .then(() => {
                this.toastService.success('Copied to clipboard!', 3000, 'bottom-right');
            })
            .catch(() => {
                this.toastService.error('Failed to copy', 3000, 'top-right');
            });
    }
}
