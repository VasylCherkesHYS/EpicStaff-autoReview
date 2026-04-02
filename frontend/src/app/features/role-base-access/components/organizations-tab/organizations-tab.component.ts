import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
    selector: 'app-workspace-main',
    templateUrl: './organizations-tab.component.html',
    styleUrls: ['./organizations-tab.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationsTabComponent {}
