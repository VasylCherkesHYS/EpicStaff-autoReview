import { Component, ElementRef, inject } from '@angular/core';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';

import { toDisplayExpression, toStoredExpression } from '../../../../../utils/condition-expression.helper';
import { ExpressionBuilderComponent } from './expression-builder.component';

export interface ExpressionBuilderCellEditorParams extends ICellEditorParams {
    variables?: string[] | (() => string[]);
    mode?: 'expression' | 'manipulation';
}

@Component({
    selector: 'app-expression-builder-cell-editor',
    imports: [ExpressionBuilderComponent],
    template: `
        <app-expression-builder
            [value]="initialDisplay"
            [variables]="variables"
            [mode]="mode"
            (valueChange)="onValueChange($event)"
            (commit)="onCommit($event)"
            (cancel)="onCancel()"
        />
    `,
    styles: [
        `
            :host {
                display: block;
                z-index: 10;
                position: relative;
                background: #1f1f23;
                min-width: 480px;
                min-height: 320px;
            }
        `,
    ],
})
export class ExpressionBuilderCellEditorComponent implements ICellEditorAngularComp {
    initialDisplay = '';
    variables: string[] = [];
    mode: 'expression' | 'manipulation' = 'expression';

    private currentDisplay = '';
    private params!: ExpressionBuilderCellEditorParams;
    private readonly elRef = inject(ElementRef);

    agInit(params: ExpressionBuilderCellEditorParams): void {
        this.params = params;
        this.initialDisplay = toDisplayExpression(params.value ?? '');
        this.currentDisplay = this.initialDisplay;
        this.mode = params.mode ?? 'expression';

        const raw = params.variables;
        if (typeof raw === 'function') {
            this.variables = (raw as () => string[])();
        } else if (Array.isArray(raw)) {
            this.variables = raw;
        } else {
            this.variables = [];
        }

        setTimeout(() => this.repositionPopup(params), 0);
    }

    private repositionPopup(params: ExpressionBuilderCellEditorParams): void {
        const cellEl = params.eGridCell as HTMLElement;
        const cellRect = cellEl.getBoundingClientRect();

        let wrapper: HTMLElement | null = this.elRef.nativeElement;
        while (wrapper && !wrapper.classList.contains('ag-popup-editor')) {
            wrapper = wrapper.parentElement;
        }
        if (!wrapper) return;

        const wrapperRect = wrapper.getBoundingClientRect();
        const popupWidth = wrapperRect.width;

        const targetTop = cellRect.top;
        const targetLeft = this.mode === 'manipulation' ? cellRect.right - popupWidth : cellRect.left;

        const dx = targetLeft - wrapperRect.left;
        const dy = targetTop - wrapperRect.top;
        wrapper.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    getValue(): string {
        return toStoredExpression(this.currentDisplay);
    }

    isPopup(): boolean {
        return true;
    }

    getPopupPosition(): 'over' | 'under' {
        return 'over';
    }

    onValueChange(displayValue: string): void {
        this.currentDisplay = displayValue;
    }

    onCommit(displayValue: string): void {
        this.currentDisplay = displayValue;
        this.params.stopEditing();
    }

    onCancel(): void {
        this.params.stopEditing(true);
    }
}
