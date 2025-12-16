import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    OnInit,
    ViewChild,
    ViewContainerRef,
    signal,
    input,
    output
} from '@angular/core';
import {PortalModule, TemplatePortal} from '@angular/cdk/portal';
import {DomPortalOutlet} from '@angular/cdk/portal';

import {AppIconComponent} from "../app-icon/app-icon.component";
import {CheckboxComponent} from "../checkbox/checkbox.component";
import {ButtonComponent} from "../buttons/button/button.component";

export interface MultiSelectItem {
    name: string;
    value: unknown;
}

@Component({
    selector: 'app-multi-select',
    standalone: true,
    imports: [
        PortalModule,
        AppIconComponent,
        CheckboxComponent,
        ButtonComponent
    ],
    templateUrl: './multi-select.component.html',
    styleUrls: ['./multi-select.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiSelectComponent implements OnInit {
    icon = input<string>('');
    label = input<string>('Select items...');
    searchPlaceholder = input<string>('Search...');
    items = input<MultiSelectItem[]>([]);
    selectedValues = input<unknown[]>([]);
    selectionChange = output<unknown[]>();

    isOpen = signal(false);
    search = signal('');
    tempSelected = signal<any[]>([]);

    @ViewChild('dropdownTemplate') dropdownTemplate!: any;
    @ViewChild('triggerBtn') triggerBtn!: ElementRef<HTMLButtonElement>;

    private portalOutlet!: DomPortalOutlet;
    private portal!: TemplatePortal;

    constructor(private viewContainerRef: ViewContainerRef) {}

    ngOnInit() {
        this.tempSelected.set([...this.selectedValues()]);
    }

    toggle() {
        if (this.isOpen()) this.close();
        else this.open();
    }

    @HostListener('document:click', ['$event'])
    onOutsideClick(event: MouseEvent) {
        if (!this.isOpen()) return;

        const target = event.target as HTMLElement;
        if (!this.triggerBtn.nativeElement.contains(target) &&
            !document.getElementById('multi-select-portal')?.contains(target)) {
            this.tempSelected.set([...this.selectedValues()]);
            this.close();
        }
    }

    positionDropdown() {
        const btn = this.triggerBtn.nativeElement.getBoundingClientRect();

        const dropdownEl = document.getElementById('multi-select-portal');
        if (!dropdownEl) return;

        dropdownEl.style.position = 'absolute';
        dropdownEl.style.top = `${btn.bottom + 4}px`;
        dropdownEl.style.left = `${btn.left}px`;
    }

    isChecked(value: any) {
        return this.tempSelected().includes(value);
    }

    toggleValue(value: any) {
        const arr = [...this.tempSelected()];
        const i = arr.indexOf(value);
        if (i >= 0) arr.splice(i, 1);
        else arr.push(value);
        this.tempSelected.set(arr);
    }

    filtered() {
        return this.items().filter(i =>
            i.name.toLowerCase().includes(this.search().toLowerCase())
        );
    }

    cancel() {
        this.tempSelected.set([...this.selectedValues()]);
        this.close();
    }

    save() {
        this.selectionChange.emit(this.tempSelected());
        this.close();
    }

    open() {
        this.isOpen.set(true);

        if (!this.portalOutlet) {
            this.portalOutlet = new DomPortalOutlet(document.body);
        }

        this.portal = new TemplatePortal(
            this.dropdownTemplate,
            this.viewContainerRef
        );

        this.portalOutlet.attach(this.portal);

        this.positionDropdown();
    }

    close() {
        this.isOpen.set(false);

        if (this.portalOutlet) {
            this.portalOutlet.detach();
        }
    }
}
