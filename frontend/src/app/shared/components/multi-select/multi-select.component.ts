import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    HostListener,
    ViewChild,
    ViewContainerRef,
    signal,
    input,
    output, inject
} from '@angular/core';
import {TemplatePortal} from '@angular/cdk/portal';

import {AppIconComponent} from "../app-icon/app-icon.component";
import {CheckboxComponent} from "../checkbox/checkbox.component";
import {ButtonComponent} from "../buttons/button/button.component";
import {Overlay, OverlayPositionBuilder, OverlayRef} from "@angular/cdk/overlay";

export interface MultiSelectItem {
    name: string;
    value: unknown;
}

@Component({
    selector: 'app-multi-select',
    standalone: true,
    imports: [
        AppIconComponent,
        CheckboxComponent,
        ButtonComponent
    ],
    templateUrl: './multi-select.component.html',
    styleUrls: ['./multi-select.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultiSelectComponent {
    icon = input<string>('');
    label = input<string>('Select items...');
    searchPlaceholder = input<string>('Search...');
    items = input<MultiSelectItem[]>([]);
    selectedValues = input<unknown[]>([]);
    selectionChange = output<unknown[]>();

    isOpen = signal(false);
    search = signal('');
    tempSelected = signal<any[]>([]);

    @ViewChild('triggerBtn') triggerBtn!: ElementRef<HTMLElement>;
    @ViewChild('dropdownTemplate') dropdownTemplate!: any;

    private overlayRef!: OverlayRef;

    private overlay = inject(Overlay);
    private overlayPositionBuilder = inject(OverlayPositionBuilder);
    private vcr = inject(ViewContainerRef);

    ngOnInit() {
        this.tempSelected.set([...this.selectedValues()]);
    }

    toggle() {
        this.isOpen() ? this.close() : this.openDropdown();
    }

    @HostListener('document:click', ['$event'])
    onOutsideClick(event: MouseEvent) {
        if (!this.isOpen()) return;

        const target = event.target as HTMLElement;
        if (!this.triggerBtn.nativeElement.contains(target) &&
            !this.overlayRef?.overlayElement.contains(target)) {
            this.tempSelected.set([...this.selectedValues()]);
            this.close();
        }
    }

    openDropdown() {
        if (!this.overlayRef) {
            const positionStrategy = this.overlayPositionBuilder
                .flexibleConnectedTo(this.triggerBtn)
                .withPositions([{
                    originX: 'start',
                    originY: 'bottom',
                    overlayX: 'start',
                    overlayY: 'top',
                    offsetY: 4
                }])
                .withPush(true);

            this.overlayRef = this.overlay.create({
                positionStrategy,
                scrollStrategy: this.overlay.scrollStrategies.reposition(),
                hasBackdrop: true,
                backdropClass: 'transparent-backdrop'
            });

            this.overlayRef.backdropClick().subscribe(() => this.close());
        }

        const portal = new TemplatePortal(this.dropdownTemplate, this.vcr);
        this.overlayRef.attach(portal);
        this.isOpen.set(true);
    }

    close() {
        if (this.overlayRef) {
            this.overlayRef.detach();
        }
        this.isOpen.set(false);
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
}
