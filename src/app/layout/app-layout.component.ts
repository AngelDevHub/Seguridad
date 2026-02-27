import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-layout.component.html',
  styles: [`
    /* ── Host ──────────────────────────────────────── */
    :host {
      display: block;
      height: 100%;
    }

    .layout-wrapper {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background-color: var(--p-surface-50, #f8f9fa);
    }

    /* ── SIDEBAR ────────────────────────────────────── */
    .sidebar {
      display: flex;
      flex-direction: column;
      width: 240px;
      min-width: 240px;
      height: 100%;
      background-color: var(--p-surface-900, #0f172a);
      color: var(--p-surface-0, #ffffff);
      box-shadow: 4px 0 20px rgba(0,0,0,0.3);
      transition: width 0.25s ease, min-width 0.25s ease;
      overflow: hidden;
    }

    .sidebar.collapsed {
      width: 64px;
      min-width: 64px;
    }

    /* ── Sidebar Header ─────────────────────────────── */
    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 16px 12px;
      border-bottom: 1px solid var(--p-surface-700, #334155);
      min-height: 72px;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      overflow: hidden;
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background-color: var(--p-primary-color, #6366f1);
      flex-shrink: 0;
    }

    .sidebar-logo i { color: #fff; font-size: 1.1rem; }

    .sidebar-text {
      overflow: hidden;
      white-space: nowrap;
      transition: opacity 0.2s ease, width 0.25s ease;
    }

    .sidebar.collapsed .sidebar-text {
      opacity: 0;
      width: 0;
      pointer-events: none;
    }

    .sidebar-title {
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1.2;
      color: var(--p-surface-0, #fff);
    }

    .sidebar-subtitle {
      font-size: 0.7rem;
      color: var(--p-surface-400, #94a3b8);
      margin-top: 2px;
    }

    /* Toggle button */
    .toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      background: transparent;
      border: 1px solid var(--p-surface-600, #475569);
      color: var(--p-surface-300, #cbd5e1);
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.15s ease, color 0.15s ease;
    }

    .toggle-btn:hover {
      background: var(--p-surface-700, #334155);
      color: var(--p-surface-0, #fff);
    }

    .toggle-btn i {
      font-size: 0.8rem;
      transition: transform 0.25s ease;
    }

    .sidebar.collapsed .toggle-btn i.pi-chevron-left {
      transform: rotate(180deg);
    }

    /* ── Nav Body ───────────────────────────────────── */
    .sidebar-nav {
      flex: 1;
      padding: 16px 8px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .nav-section-label {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--p-surface-500, #64748b);
      padding: 0 8px;
      margin-bottom: 6px;
      white-space: nowrap;
      transition: opacity 0.2s ease;
    }

    .sidebar.collapsed .nav-section-label {
      opacity: 0;
    }

    .nav-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 10px;
      border-radius: 8px;
      color: var(--p-surface-300, #cbd5e1);
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      white-space: nowrap;
      transition: background 0.15s ease, color 0.15s ease;
      cursor: pointer;
      overflow: hidden;
    }

    .nav-link:hover {
      background-color: var(--p-surface-700, #334155);
      color: var(--p-surface-0, #fff);
    }

    .nav-link.active-link {
      background-color: var(--p-primary-color, #6366f1);
      color: #fff;
    }

    .nav-link i {
      width: 20px;
      min-width: 20px;
      text-align: center;
      font-size: 1rem;
    }

    .nav-label {
      transition: opacity 0.2s ease;
      white-space: nowrap;
    }

    .sidebar.collapsed .nav-label {
      opacity: 0;
      width: 0;
      overflow: hidden;
    }

    /* Tooltip while collapsed */
    .sidebar.collapsed .nav-link {
      justify-content: center;
      padding: 10px;
      position: relative;
    }

    /* ── Footer ────────────────────────────────────── */
    .sidebar-footer {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 14px;
      border-top: 1px solid var(--p-surface-700, #334155);
      overflow: hidden;
    }

    .sidebar-footer i {
      color: var(--p-surface-500, #64748b);
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .footer-text {
      font-size: 0.75rem;
      color: var(--p-surface-500, #64748b);
      white-space: nowrap;
      transition: opacity 0.2s ease;
    }

    .sidebar.collapsed .footer-text {
      opacity: 0;
      width: 0;
    }

    /* ── Main ──────────────────────────────────────── */
    .main-content {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      transition: flex 0.25s ease;
    }
  `],
})
export class AppLayoutComponent {
  readonly projectName = signal<string>('Mi Proyecto ERP');
  readonly appVersion = signal<string>('v2.0.0');
  readonly isCollapsed = signal<boolean>(false);

  toggleSidebar(): void {
    this.isCollapsed.update(v => !v);
  }
}
