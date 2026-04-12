import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { TooltipModule } from 'primeng/tooltip';
import { ButtonModule } from 'primeng/button';
import { DividerModule } from 'primeng/divider';
import { IfHasPermissionDirective } from '../core/directives/if-has-permission.directive';
import { PermissionsService } from '../core/services/permissions.service';
import { AuthService } from '../core/services/auth.service';
import { GroupCrudService } from '../core/services/group-crud.service';
import { TicketService } from '../core/services/ticket.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, TooltipModule, ButtonModule, DividerModule, IfHasPermissionDirective],
  templateUrl: './app-layout.component.html',
})
export class AppLayoutComponent implements OnInit, OnDestroy {
  readonly projectName = signal<string>('Mi Proyecto ERP');
  readonly appVersion  = signal<string>('v2.0.0');
  readonly isCollapsed = signal<boolean>(false);
  private readonly router   = inject(Router);
  private readonly permsSvc = inject(PermissionsService);
  private readonly authSvc  = inject(AuthService);
  private readonly groupSvc = inject(GroupCrudService);
  private readonly ticketSvc = inject(TicketService);
  private permsInterval: any = null;

  toggleSidebar(): void { this.isCollapsed.update(v => !v); }

  ngOnInit(): void {
    if (this.authSvc.isLogged()) {
      const u = this.authSvc.getCurrentUser();
      this.permsSvc.setPermissions(u?.permissions ?? []);
    }
    if (this.authSvc.isBackendMode() && this.authSvc.isLogged()) {
      const refresh = () => {
        this.authSvc.refreshMeFromBackend().subscribe((u) => {
          if (u) this.permsSvc.setPermissions(u.permissions ?? []);
        });
      };
      refresh();
      this.permsInterval = setInterval(refresh, 15_000);
      this.groupSvc.refreshFromBackend();
      this.ticketSvc.refreshAll();
    }
  }
  
  ngOnDestroy(): void {
    if (this.permsInterval) clearInterval(this.permsInterval);
  }

  logout(): void {
    this.authSvc.logout();
    this.permsSvc.clearPermissions();
    this.router.navigate(['/login']);
  }

  isActive(path: string): boolean { return this.router.url.startsWith('/' + path); }

  /** Estilo de cada enlace de navegación */
  navStyle(path: string, hovered: boolean) {
    const active = this.isActive(path);
    return {
      display: 'flex',
      'align-items': 'center',
      gap: '12px',
      padding: '10px 12px',
      'border-radius': '8px',
      'text-decoration': 'none',
      'font-size': '0.875rem',
      'font-weight': '500',
      'white-space': 'nowrap',
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'background 0.15s ease, color 0.15s ease',
      background:  active  ? 'var(--p-primary-color)' : hovered ? 'var(--p-surface-100)' : 'transparent',
      color:       active  ? 'var(--p-primary-contrast-color)' : 'var(--p-surface-700)',
    };
  }
}
