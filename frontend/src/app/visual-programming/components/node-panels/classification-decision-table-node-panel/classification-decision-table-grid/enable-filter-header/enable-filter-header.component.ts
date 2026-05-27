import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    inject,
    TemplateRef,
    ViewChild,
    ViewContainerRef,
} from '@angular/core';
import { IHeaderAngularComp } from 'ag-grid-angular';
import { IHeaderParams } from 'ag-grid-community';

import { AppSvgIconComponent } from '../../../../../../shared/components/app-svg-icon/app-svg-icon.component';

export type EnableFilterMode = 'all' | 'enabled' | 'disabled';

interface EnableFilterHeaderParams extends IHeaderParams {
    getMode: () => EnableFilterMode;
    setMode: (mode: EnableFilterMode) => void;
}

@Component({
    selector: 'app-enable-filter-header',
    imports: [CommonModule, AppSvgIconComponent],
    template: `
        <div class="enable-header">
            <span class="enable-label">{{ label }}</span>
            <button
                type="button"
                #anchor
                class="enable-filter-btn"
                [class.active]="mode !== 'enabled'"
                (click)="openMenu()"
                title="Filter rows"
            >
                <app-svg-icon
                    icon="filter-rows"
                    size="14px"
                ></app-svg-icon>
            </button>
        </div>

        <ng-template #menuTemplate>
            <div class="ef-dropdown">
                <div
                    class="ef-item"
                    [class.selected]="mode === 'all'"
                    (click)="select('all')"
                >
                    Enable/Disable
                </div>
                <div
                    class="ef-item"
                    [class.selected]="mode === 'enabled'"
                    (click)="select('enabled')"
                >
                    Only Enable
                </div>
                <div
                    class="ef-item"
                    [class.selected]="mode === 'disabled'"
                    (click)="select('disabled')"
                >
                    Only Disable
                </div>
            </div>
        </ng-template>
    `,
    styles: [
        `
            :host {
                display: block;
                width: 100%;
                height: 100%;
            }
            .enable-header {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 4px;
                width: 100%;
                height: 100%;
            }
            .enable-label {
                color: rgba(255, 255, 255, 0.9);
                font-size: 0.85rem;
                font-weight: 500;
            }
            .enable-filter-btn {
                width: 18px;
                height: 18px;
                padding: 0;
                border: none;
                background: transparent;
                color: rgba(255, 255, 255, 0.6);
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                transition: color 0.15s ease;
            }
            .enable-filter-btn:hover {
                color: var(--purple-primary);
            }
            .ef-dropdown {
                background: #212325;
                border: 1px solid #2b2d30;
                border-radius: 8px;
                padding: 4px;
                box-shadow:
                    0 6px 10px 4px rgba(0, 0, 0, 0.15),
                    0 2px 3px rgba(0, 0, 0, 0.3);
                min-width: 160px;
            }
            .ef-item {
                padding: 8px 12px;
                font-size: 13px;
                color: #d9d9de;
                border-radius: 4px;
                cursor: pointer;
                user-select: none;
            }
            .ef-item:hover {
                background: rgba(255, 255, 255, 0.04);
            }
            .ef-item.selected {
                color: var(--purple-primary);
            }
        `,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnableFilterHeaderComponent implements IHeaderAngularComp {
    private overlay = inject(Overlay);
    private vcr = inject(ViewContainerRef);
    private cdr = inject(ChangeDetectorRef);

    @ViewChild('anchor', { read: ElementRef, static: true }) anchorEl!: ElementRef<HTMLElement>;
    @ViewChild('menuTemplate', { static: true }) menuTemplate!: TemplateRef<unknown>;

    public label = 'Enable';
    public mode: EnableFilterMode = 'enabled';
    private overlayRef: OverlayRef | null = null;
    private params!: EnableFilterHeaderParams;

    agInit(params: EnableFilterHeaderParams): void {
        this.params = params;
        this.mode = params.getMode();
        this.label = this.mode === 'all' ? 'En/Dis' : 'Enable';
    }

    refresh(params: EnableFilterHeaderParams): boolean {
        this.params = params;
        this.mode = params.getMode();
        this.label = this.mode === 'all' ? 'En/Dis' : 'Enable';
        this.cdr.markForCheck();
        return true;
    }

    public openMenu(): void {
        if (this.overlayRef) {
            this.closeMenu();
            return;
        }
        const positionStrategy = this.overlay
            .position()
            .flexibleConnectedTo(this.anchorEl.nativeElement)
            .withPositions([{ originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4 }]);
        this.overlayRef = this.overlay.create({
            positionStrategy,
            scrollStrategy: this.overlay.scrollStrategies.close(),
            hasBackdrop: true,
            backdropClass: 'cdk-overlay-transparent-backdrop',
        });
        this.overlayRef.backdropClick().subscribe(() => this.closeMenu());
        this.overlayRef.attach(new TemplatePortal(this.menuTemplate, this.vcr));
    }

    public select(mode: EnableFilterMode): void {
        this.params.setMode(mode);
        this.mode = mode;
        this.label = mode === 'all' ? 'En/Dis' : 'Enable';
        this.cdr.markForCheck();
        this.closeMenu();
    }

    private closeMenu(): void {
        this.overlayRef?.detach();
        this.overlayRef?.dispose();
        this.overlayRef = null;
    }
}
