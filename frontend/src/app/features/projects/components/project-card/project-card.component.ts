import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { Project } from '../../models/project.model';
import { ProjectMenuComponent } from './project-menu/project-menu.component';
import { AppIconComponent } from '../../../../shared/components/app-icon/app-icon.component';

@Component({
    selector: 'app-project-card',
    standalone: true,
  imports: [ProjectMenuComponent, AppIconComponent],
    templateUrl: './project-card.component.html',
    styleUrls: ['./project-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectCardComponent {
  project = input.required<Project>();
  cardClick = output<void>();
  actionClick = output<{ action: string; project: Project }>();

  isMenuOpenSig = signal(false);

  onMenuToggle(isOpen: boolean): void {
    this.isMenuOpenSig.set(isOpen);
    }

  onActionSelected(action: string): void {
    this.actionClick.emit({ action, project: this.project() });
    }
}
