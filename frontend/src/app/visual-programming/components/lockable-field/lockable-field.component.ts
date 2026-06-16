import {
    ChangeDetectionStrategy,
    Component,
    computed,
    HostListener,
    inject,
    input,
    OnDestroy,
} from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GraphCollaborationWsService } from 'src/app/features/flows/services/graph-collaboration.ws.service';
import { ProfileService } from 'src/app/services/auth/profile.service';
import { getAvatarColor } from '../../core/helpers/avatar-colors';

@Component({
    selector: 'app-lockable-field',
    standalone: true,
    imports: [MatTooltipModule],
    template: `
        <ng-content></ng-content>
        @if (fieldLock()) {
            <div
                class="lock-indicator"
                [style.background]="lockColor()"
                [matTooltip]="'Editing by ' + (fieldLock()?.display_name ?? 'User')"
                matTooltipPosition="above"
            >
                {{ initials() }}
            </div>
        }
    `,
    styles: [`
        :host {
            display: block;
            position: relative;
        }
        :host.locked-by-other {
            pointer-events: none;
            opacity: 0.65;
        }
        .lock-indicator {
            position: absolute;
            top: -8px;
            right: -8px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            color: white;
            font-size: 8px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
            pointer-events: auto;
            cursor: default;
        }
    `],
    host: {
        '[class.locked-by-other]': 'isLockedByOther()',
        '[class.locked-by-me]': 'isLockedByMe()',
        '[style.--field-lock-color]': 'lockColor()',
    },
    changeDetection: ChangeDetectionStrategy.OnPush,
})

export class LockableFieldComponent implements OnDestroy {
    readonly fieldId = input.required<string>();
    readonly nodeId = input.required<string>();

    private readonly wsService = inject(GraphCollaborationWsService);
    private readonly profileService = inject(ProfileService);

    protected readonly fieldLock = computed(() =>
        this.wsService.lockedNodeFields().get(this.nodeId())?.get(this.fieldId()) ?? null
    );

    protected readonly isLockedByOther = computed(() => {
        const lock = this.fieldLock();
        if (!lock) return false;
        return lock.user_id !== this.profileService.currentUserSignal()?.id;
    });

    protected readonly isLockedByMe = computed(() => {
        const lock = this.fieldLock();
        if (!lock) return false;
        return lock.user_id === this.profileService.currentUserSignal()?.id;
    });

    protected readonly lockColor = computed(() => {
        const lock = this.fieldLock();
        return lock ? getAvatarColor(lock.user_id): null;
    });

    protected readonly initials = computed(() => {
        const lock = this.fieldLock();
        if (!lock?.display_name) return '?';
        const words = lock.display_name.trim().split(/\s+/);
        return words.length >=2
            ? (words[0][0] + words[1][0]).toUpperCase()
            : words[0].slice(0, 2).toUpperCase();
    });

    @HostListener('focusin')
    onFocusIn(): void {
        if (!this.isLockedByOther()) {
            this.wsService.sendNodeLocked(this.nodeId(), this.fieldId());
        }
    }

    @HostListener('focusout', ['$event'])
    onFocusOut(event: FocusEvent): void {
        const relatedTarget = event.relatedTarget as Node | null;
        if (relatedTarget && (event.currentTarget as HTMLElement).contains(relatedTarget)) return;
        if (this.isLockedByMe()) {
            this.wsService.sendNodeUnlocked(this.nodeId(), this.fieldId());
        }
    }

    ngOnDestroy(): void {
        if (this.isLockedByMe()) {
            this.wsService.sendNodeUnlocked(this.nodeId(), this.fieldId());
        }
    }
}