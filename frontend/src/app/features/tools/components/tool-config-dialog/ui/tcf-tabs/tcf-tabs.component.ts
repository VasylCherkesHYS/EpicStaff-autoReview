import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

export interface TcfTab {
  icon: string;
  label: string;
  badge?: number;
}

@Component({
  selector: 'tcf-tabs',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="tcf-tabs">
      <div class="tcf-tabs__header">
        @for (tab of tabs(); track $index) {
          <button
            class="tcf-tabs__btn"
            [class.tcf-tabs__btn--active]="activeIndex() === $index"
            (click)="onTabClick($index)"
          >
            <mat-icon>{{ tab.icon }}</mat-icon>
            <span>{{ tab.label }}</span>
            @if (tab.badge !== undefined) {
              <span class="tcf-tabs__badge">{{ tab.badge }}</span>
            }
          </button>
        }
      </div>
      <div class="tcf-tabs__content">
        <ng-content></ng-content>
      </div>
    </div>
  `,
  styleUrl: './tcf-tabs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TcfTabsComponent {
  tabs = input<TcfTab[]>([]);
  activeIndex = input<number>(0);
  tabChange = output<number>();

  onTabClick(index: number): void {
    this.tabChange.emit(index);
  }
}

