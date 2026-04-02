import { ChangeDetectionStrategy, Component, input, OnInit } from '@angular/core';
import { AppSvgIconComponent } from '@shared/components';

@Component({
    selector: 'app-stat-card',
    templateUrl: './stat-card.component.html',
    styleUrls: ['./stat-card.component.scss'],
    imports: [AppSvgIconComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatCardComponent {
    icon = input<string>('');
    title = input.required<string>();
    value = input.required<number>();
    deltaValue = input.required<number | null>();
    deltaDirection = input.required<'increase'>();
    deltaColor = input.required<'green' | 'red'>();
    deltaLabel = input.required<string>();
}
