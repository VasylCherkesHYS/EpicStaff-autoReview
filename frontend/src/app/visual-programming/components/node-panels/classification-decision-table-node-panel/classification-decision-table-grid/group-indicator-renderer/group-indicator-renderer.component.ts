import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';

import { AppSvgIconComponent } from '../../../../../../shared/components/app-svg-icon/app-svg-icon.component';

@Component({
    selector: 'app-group-indicator-renderer',
    imports: [CommonModule, AppSvgIconComponent],
    template: `
        @if (showChevron()) {
            <button
                type="button"
                class="group-chevron-btn"
                [class.collapsed]="isCollapsed()"
                (click)="openMenu($event)"
                title="Group options"
            >
                <app-svg-icon
                    icon="play"
                    size="8px"
                ></app-svg-icon>
            </button>
        } @else if (inGroup()) {
            <span class="group-line"></span>
        }
    `,
    styles: [
        `
            :host {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
                position: relative;
            }
            .group-chevron-btn {
                width: 18px;
                height: 18px;
                padding: 0;
                border: 1px solid #2b2d30;
                border-radius: 4px;
                background: #212325;
                color: #d9d9de;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            }
            .group-chevron-btn app-svg-icon {
                transform: rotate(90deg);
                transition: transform 0.15s ease;
            }
            .group-chevron-btn.collapsed app-svg-icon {
                transform: rotate(0deg);
            }
            .group-line {
                display: block;
                width: 2px;
                height: 100%;
                background: #2b2d30;
            }
        `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupIndicatorRendererComponent implements ICellRendererAngularComp {
    public sectionId = signal<string | null>(null);
    public isFirstInGroup = signal<boolean>(false);
    public isCollapsed = signal<boolean>(false);
    public inGroup = computed(() => !!this.sectionId());
    public showChevron = computed(() => this.isFirstInGroup());

    private onMenuClick: ((sectionId: string, anchor: HTMLElement) => void) | undefined;

    agInit(
        params: ICellRendererParams & {
            collapsedGroups: Set<string>;
            onMenuClick: (sectionId: string, anchor: HTMLElement) => void;
        }
    ): void {
        this.refresh(params);
    }

    refresh(
        params: ICellRendererParams & {
            collapsedGroups?: Set<string>;
            onMenuClick?: (sectionId: string, anchor: HTMLElement) => void;
        }
    ): boolean {
        const data = params.data as { section?: string | null } | undefined;
        const section = data?.section ?? null;
        this.sectionId.set(section);
        this.onMenuClick = params.onMenuClick ?? this.onMenuClick;
        this.isCollapsed.set(!!(section && params.collapsedGroups?.has(section)));
        const api = params.api;
        const rowIndex = params.node.rowIndex ?? -1;
        let isFirst = false;
        if (section && rowIndex >= 0) {
            const prevNode = rowIndex > 0 ? api.getDisplayedRowAtIndex(rowIndex - 1) : null;
            const prevSection = (prevNode?.data as { section?: string | null } | undefined)?.section ?? null;
            isFirst = prevSection !== section;
        }
        this.isFirstInGroup.set(isFirst);
        return true;
    }

    public openMenu(event: MouseEvent): void {
        event.stopPropagation();
        const section = this.sectionId();
        if (section && this.onMenuClick) {
            this.onMenuClick(section, event.currentTarget as HTMLElement);
        }
    }
}
