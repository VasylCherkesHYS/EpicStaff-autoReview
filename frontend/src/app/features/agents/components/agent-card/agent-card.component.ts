import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { Agent } from '../../models/agent.model';
import { AppIconComponent } from '../../../../shared/components/app-icon/app-icon.component';

@Component({
  selector: 'app-agent-card',
  standalone: true,
  imports: [AppIconComponent],
  templateUrl: './agent-card.component.html',
  styleUrls: ['./agent-card.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgentCardComponent {
  agent = input.required<Agent>();
  cardClick = output<void>();
}

