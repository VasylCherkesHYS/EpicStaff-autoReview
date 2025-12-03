import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-project-menu-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-menu-item.component.html',
  styleUrls: ['./project-menu-item.component.scss'],
})
export class ProjectMenuItemComponent {
  label = input.required<string>();
  isDelete = input(false);
  itemClick = output<MouseEvent>();

  onClick(event: MouseEvent): void {
    this.itemClick.emit(event);
  }
}
