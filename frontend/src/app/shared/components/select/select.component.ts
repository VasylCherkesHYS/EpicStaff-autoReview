import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    ViewContainerRef,
    ViewChild,
    signal,
    input,
    model, output, computed
} from '@angular/core';

import {TemplatePortal, DomPortalOutlet} from '@angular/cdk/portal';
import {NgClass} from "@angular/common";

export interface SelectItem {
    name: string;
    value: unknown;
}

@Component({
    selector: 'app-select',
    standalone: true,
    imports: [NgClass],
    templateUrl: './select.component.html',
    styleUrl: './select.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectComponent {
    mod = input<'default' | 'small'>('default');
    items = input<SelectItem[]>([]);
    placeholder = input<string>('Select option');

    selectedValue = model<unknown | null>(null);
    selectedItem = computed(() => {
        const value = this.selectedValue();
        if (value === undefined || value === null) return null;

        return this.items().find(i => i.value === value) ?? null;
    });

    changed = output<any>();

    open = signal(false);

    @ViewChild('triggerBtn') triggerBtn!: ElementRef<HTMLButtonElement>;
    @ViewChild('dropdownTemplate') dropdownTemplate!: any;

    private portal!: TemplatePortal;
    private outlet!: DomPortalOutlet;

    constructor(private vcr: ViewContainerRef) {}

    toggle() {
        this.open() ? this.close() : this.openDropdown();
    }

    openDropdown() {
        this.open.set(true);

        if (!this.outlet) {
            this.outlet = new DomPortalOutlet(document.body);
        }

        this.portal = new TemplatePortal(this.dropdownTemplate, this.vcr);
        this.outlet.attach(this.portal);

        this.positionDropdown();
    }

    close() {
        this.open.set(false);
        if (this.outlet) this.outlet.detach();
    }

    positionDropdown() {
        const trigger = this.triggerBtn.nativeElement.getBoundingClientRect();
        const dd = document.getElementById('selector-portal');
        if (!dd) return;

        dd.style.top = `${trigger.bottom + 4}px`;
        dd.style.left = `${trigger.left}px`;
    }
    @HostListener('document:click', ['$event'])
    onDocClick(e: MouseEvent) {
        if (!this.open()) return;

        const t = e.target as HTMLElement;
        const dropdownEl = document.getElementById('selector-portal');

        if (
            !this.triggerBtn.nativeElement.contains(t) &&
            dropdownEl && !dropdownEl.contains(t)
        ) {
            this.close();
        }
    }

    select(item: SelectItem) {
        this.selectedValue.set(item.value);
        this.changed.emit(item.value);
        this.close();
    }
}
