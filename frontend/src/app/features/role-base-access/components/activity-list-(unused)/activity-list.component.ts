import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AppSvgIconComponent } from '@shared/components';

export interface ActivityItem {
    id: number;
    time: string;
    parts: { text: string; accent: boolean }[];
}

@Component({
    selector: 'app-activity-list',
    imports: [AppSvgIconComponent],
    templateUrl: './activity-list.component.html',
    styleUrls: ['./activity-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActivityListComponent {
    activities = input.required<ActivityItem[]>();
}
