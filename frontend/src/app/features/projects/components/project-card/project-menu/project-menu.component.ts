import {
  Component,
  ChangeDetectionStrategy,
  signal,
  input,
  output,
  effect,
  OnDestroy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { ProjectMenuItemComponent } from './project-menu-item/project-menu-item.component';
import { AppIconComponent } from '../../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-project-menu',
  standalone: true,
  imports: [NgClass, ProjectMenuItemComponent, AppIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './project-menu.component.html',
  styleUrls: ['./project-menu.component.scss'],
})
export class ProjectMenuComponent implements OnDestroy {
  isOpen = input(false);
  menuToggle = output<boolean>();
  actionSelected = output<string>();

  private readonly isMouseOnButton = signal(false);
  private readonly isMouseOnMenu = signal(false);
  readonly isMenuOpenSig = signal(false);
  private closeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => this.isMenuOpenSig.set(this.isOpen()));
  }

  toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    const newState = !this.isMenuOpenSig();
    this.isMenuOpenSig.set(newState);
    if (newState) {
      this.cancelCloseTimeout();
      this.isMouseOnButton.set(true);
      this.isMouseOnMenu.set(false);
    }
    this.menuToggle.emit(newState);
  }

  onButtonEnter(): void {
    this.isMouseOnButton.set(true);
    this.cancelCloseTimeout();
  }

  onButtonLeave(): void {
    this.isMouseOnButton.set(false);
    this.scheduleClose();
  }

  onMenuEnter(): void {
    this.isMouseOnMenu.set(true);
    this.cancelCloseTimeout();
  }

  onMenuLeave(): void {
    this.isMouseOnMenu.set(false);
    this.scheduleClose();
  }

  private scheduleClose(): void {
    if (this.isMenuOpenSig() && !this.isMouseOnButton() && !this.isMouseOnMenu()) {
      this.closeTimeout = setTimeout(() => {
        if (this.isMenuOpenSig() && !this.isMouseOnButton() && !this.isMouseOnMenu()) {
          this.close();
        }
      }, 100);
    }
  }

  private cancelCloseTimeout(): void {
    if (this.closeTimeout) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  }

  close(): void {
    this.cancelCloseTimeout();
    this.isMenuOpenSig.set(false);
    this.menuToggle.emit(false);
    this.isMouseOnButton.set(false);
    this.isMouseOnMenu.set(false);
  }

  onActionClick(event: MouseEvent, action: string): void {
    event.stopPropagation();
    if (this.isMenuOpenSig()) {
      this.actionSelected.emit(action);
      this.close();
    }
  }

  ngOnDestroy(): void {
    this.cancelCloseTimeout();
  }
}
