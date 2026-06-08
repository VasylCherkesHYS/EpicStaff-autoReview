import { CommonModule } from '@angular/common';
import { Component, inject, Input, ViewEncapsulation } from '@angular/core';
import { NgxJsonViewerModule } from 'ngx-json-viewer';

import { ToastService } from '../../../../../../services/notifications/toast.service';
import { expandCollapseAnimation } from '../../../../../../shared/animations/animations-expand-collapse';
import { AppSvgIconComponent } from '../../../../../../shared/components/app-svg-icon/app-svg-icon.component';
import { GraphMessage } from '../../../../models/graph-session-message.model';

@Component({
    selector: 'app-start-message',
    standalone: true,
    imports: [CommonModule, NgxJsonViewerModule, AppSvgIconComponent],
    encapsulation: ViewEncapsulation.Emulated,
    animations: [expandCollapseAnimation],
    template: `
        <div class="start-container">
            <div
                class="start-header"
                (click)="toggleMessage()"
            >
                <div
                    class="play-arrow"
                    *ngIf="hasInputs()"
                >
                    <app-svg-icon
                        [icon]="isMessageExpanded ? 'caret-down-filled' : 'caret-right-filled'"
                        size="1.1rem"
                    />
                </div>
                <div class="icon-container">
                    <app-svg-icon
                        icon="flag"
                        size="1.25rem"
                    />
                </div>
                <h3>
                    <span class="node-name">{{ message.name }}</span> started
                </h3>
            </div>

            <!-- Collapsible Content -->
            <div
                class="collapsible-content"
                [@expandCollapse]="isMessageExpanded ? 'expanded' : 'collapsed'"
            >
                <div class="start-content">
                    <!-- Input Parameters Section -->
                    <div
                        class="input-container"
                        *ngIf="hasInputs()"
                    >
                        <div
                            class="section-heading"
                            (click)="toggleInputs($event)"
                        >
                            <app-svg-icon
                                [icon]="isInputsExpanded ? 'caret-down-filled' : 'caret-right-filled'"
                                size="1.1rem"
                            />
                            Input Parameters
                        </div>
                        <div
                            class="collapsible-content"
                            [@expandCollapse]="isInputsExpanded ? 'expanded' : 'collapsed'"
                        >
                            <div class="input-content">
                                <button
                                    class="copy-btn"
                                    (click)="copyContent($event)"
                                    aria-label="Copy input parameters"
                                >
                                    <app-svg-icon
                                        icon="copy"
                                        size="0.875rem"
                                    />
                                </button>
                                <ngx-json-viewer
                                    [json]="getStartInput()"
                                    [expanded]="false"
                                ></ngx-json-viewer>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [
        `
            .start-container {
                position: relative;
                background-color: var(--color-nodes-background);
                border-radius: 8px;
                padding: var(--message-padding, 1.25rem);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                border-left: 4px solid #d29922;
            }

            .start-header {
                display: flex;
                align-items: center;
                cursor: pointer;
                user-select: none;
            }

            .play-arrow {
                margin-right: 16px;
                display: flex;
                align-items: center;

                app-svg-icon {
                    color: #d29922;
                }
            }

            .icon-container {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background-color: #d29922;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 20px;
                flex-shrink: 0;

                app-svg-icon {
                    color: var(--gray-900);
                }
            }

            h3 {
                color: var(--gray-100);
                font-size: 1.1rem;
                font-weight: 600;
                margin: 0;
            }

            .node-name {
                color: #d29922;
                font-weight: 400;
            }

            /* Collapsible content container */
            .collapsible-content {
                overflow: hidden;
                position: relative;
            }

            .collapsible-content.ng-animating {
                overflow: hidden;
            }

            .start-content {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                padding-left: 5.5rem;
                margin-top: 1.25rem;
            }

            /* Section styling */
            .section-heading {
                font-weight: 500;
                color: var(--gray-300);
                margin-bottom: 0.5rem;
                cursor: pointer;
                user-select: none;
                display: flex;
                align-items: center;
            }

            .section-heading app-svg-icon {
                margin-right: 8px;
                color: #d29922;
                margin-left: -3px;
            }

            .input-container {
                margin-bottom: 0.5rem;
            }

            .input-content {
                position: relative;
                background-color: var(--gray-800);
                border: 1px solid var(--gray-750);
                border-radius: 8px;
                padding: 1rem;
                overflow: auto;
                max-height: 400px;
                margin-left: 23px;

                &:hover .copy-btn {
                    opacity: 1;
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
export class StartMessageComponent {
    @Input() message!: GraphMessage;
    isMessageExpanded = false;
    isInputsExpanded = true;

    private readonly toastService = inject(ToastService);

    toggleMessage(): void {
        if (!this.hasInputs()) return;
        this.isMessageExpanded = !this.isMessageExpanded;
    }

    toggleInputs(event: Event): void {
        // Stop the click event from propagating to parent elements
        event.stopPropagation();
        this.isInputsExpanded = !this.isInputsExpanded;
    }

    hasInputs(): boolean {
        const input = this.getStartInput();
        return input && Object.keys(input).length > 0;
    }

    copyContent(event: Event): void {
        event.stopPropagation();
        navigator.clipboard
            .writeText(JSON.stringify(this.getStartInput(), null, 2))
            .then(() => {
                this.toastService.success('Copied to clipboard!', 3000, 'bottom-right');
            })
            .catch(() => {
                this.toastService.error('Failed to copy', 3000, 'top-right');
            });
    }

    getStartInput(): Record<string, unknown> {
        if (!this.message.message_data) return {};

        if (this.message.message_data.message_type === 'start' && 'input' in this.message.message_data) {
            return this.message.message_data.input;
        }

        return {};
    }
}
