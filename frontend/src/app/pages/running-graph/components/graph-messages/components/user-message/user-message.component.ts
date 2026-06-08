import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';

import { ToastService } from '../../../../../../services/notifications/toast.service';
import { AppSvgIconComponent } from '../../../../../../shared/components/app-svg-icon/app-svg-icon.component';
import { GraphMessage, MessageType, UserMessageData } from '../../../../models/graph-session-message.model';

@Component({
    selector: 'app-user-message',
    standalone: true,
    imports: [CommonModule, AppSvgIconComponent],
    template: `
        <div class="user-message-container">
            <div class="message-bubble">
                <button
                    class="copy-btn"
                    (click)="copyContent($event)"
                    aria-label="Copy message"
                >
                    <app-svg-icon
                        icon="copy"
                        size="0.875rem"
                    />
                </button>
                <span class="message-text">{{ getMessageText() }}</span>
            </div>
        </div>
    `,
    styles: [
        `
            .user-message-container {
                display: flex;
                justify-content: flex-end;
                position: relative;
            }

            .message-bubble {
                position: relative;
                background-color: #ffa726;
                border-radius: 18px 18px 0 18px;
                padding: 0.75rem 1rem;
                color: var(--gray-900);
                max-width: 85%;
                word-break: break-word;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);

                &:hover .copy-btn {
                    opacity: 1;
                }
            }

            .copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                width: 24px;
                height: 24px;
                border: none;
                border-radius: 6px;
                background: transparent;
                color: rgba(0, 0, 0, 0.4);
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
                    background: rgba(0, 0, 0, 0.08);
                    color: rgba(0, 0, 0, 0.8);
                }
            }

            .message-text {
                color: var(--gray-900);
                white-space: pre-wrap;
            }
        `,
    ],
})
export class UserMessageComponent {
    @Input() message!: GraphMessage;

    private readonly toastService = inject(ToastService);

    get userMessageData(): UserMessageData | null {
        if (this.message.message_data && this.message.message_data.message_type === MessageType.USER) {
            return this.message.message_data as UserMessageData;
        }
        return null;
    }
    //workaround
    getMessageText(): string {
        if (this.userMessageData?.text === '</done/>') {
            return 'Done';
        }
        return this.userMessageData?.text || '';
    }

    copyContent(event: Event): void {
        event.stopPropagation();
        navigator.clipboard
            .writeText(this.getMessageText())
            .then(() => {
                this.toastService.success('Copied to clipboard!', 3000, 'bottom-right');
            })
            .catch(() => {
                this.toastService.error('Failed to copy', 3000, 'top-right');
            });
    }
}
