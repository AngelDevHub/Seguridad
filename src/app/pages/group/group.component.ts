import { Component, inject } from '@angular/core';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { GroupDataService } from '../../core/services/group-data.service';

@Component({
  selector: 'app-group',
  standalone: true,
  imports: [CardModule, ProgressBarModule, TagModule],
  templateUrl: './group.component.html',
  styles: [`
    .page-header { margin-bottom: 24px; }
    .page-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--p-surface-900, #1a1a2e);
      margin: 0;
    }
    .page-subtitle {
      font-size: 0.85rem;
      color: var(--p-surface-500, #757575);
      margin: 4px 0 0 0;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 24px;
    }
    .stat-card-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .stat-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--p-surface-500, #757575);
      margin: 0 0 4px 0;
    }
    .stat-value {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--p-surface-900, #1a1a2e);
      line-height: 1;
    }
    .stat-value.primary { color: var(--p-primary-color, #6366f1); }
    .stat-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
    }
    .stat-icon.purple-bg { background-color: #ede9fe; }
    .stat-icon.green-bg  { background-color: #dcfce7; }
    .stat-icon-inner { font-size: 1.5rem; }
    .stat-icon.purple-bg .stat-icon-inner { color: var(--p-primary-color, #6366f1); }
    .stat-icon.green-bg  .stat-icon-inner { color: #22c55e; }
    .stat-footer {
      margin-top: 16px;
    }
    .stat-footer-note {
      font-size: 0.75rem;
      color: var(--p-surface-400, #9e9e9e);
      margin: 4px 0 0 0;
    }
    .stat-footer-badges {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
    }
    .stat-footer-cycle {
      font-size: 0.75rem;
      color: var(--p-surface-400, #9e9e9e);
    }
  `],
})
export class GroupComponent {
  readonly groupData = inject(GroupDataService);
}
