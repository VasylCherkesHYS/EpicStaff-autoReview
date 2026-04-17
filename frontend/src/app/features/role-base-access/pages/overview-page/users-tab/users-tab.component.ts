import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
    selector: 'app-workspace-main',
    templateUrl: './users-tab.component.html',
    styleUrls: ['./users-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersTabComponent {}
