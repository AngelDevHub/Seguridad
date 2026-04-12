import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptors, HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { MessageService, ConfirmationService } from 'primeng/api';
import Aura from '@primeuix/themes/aura';
import { catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { AuthService } from './core/services/auth.service';

/**
 * Interceptor de autenticación basado en cookies HttpOnly.
 *
 * El JWT ya no se almacena en localStorage — ms-users lo emite como
 * cookie HttpOnly (erp_token) al hacer login. El navegador la envía
 * automáticamente en cada request al mismo origen (API Gateway).
 *
 * Solo necesitamos configurar `withCredentials: true` para que Angular
 * incluya las cookies en los XMLHttpRequests.
 */
const authCredentialsInterceptor: HttpInterceptorFn = (req, next) => {
  // Solo aplicar credenciales a requests hacia el API Gateway
  if (typeof req.url === 'string' && req.url.startsWith(environment.apiUrl)) {
    req = req.clone({ withCredentials: true });
  }
  return next(req);
};

const auth401Interceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && req.url.startsWith(environment.apiUrl)) {
        auth.clearLocalSession();
        if (router.url !== '/login') router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};

const apiErrorToastInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(MessageService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && req.url.startsWith(environment.apiUrl)) {
        if (err.status !== 401) {
          const path = new URL(err.url!, window.location.origin).pathname;
          let friendly: string | null = null;
          if (err.status === 403) {
            if (path.startsWith('/api/groups/') && req.method === 'PATCH') {
              friendly = 'No puedes editar este grupo: solo el creador puede hacerlo.';
            } else if (path.startsWith('/api/groups/') && req.method === 'DELETE') {
              friendly = 'No puedes eliminar este grupo: solo el creador puede hacerlo.';
            } else if (path.startsWith('/api/tickets/') && req.method === 'PATCH') {
              friendly = 'No puedes editar este ticket: solo el creador puede hacerlo.';
            } else if (path.startsWith('/api/tickets/') && req.method === 'DELETE') {
              friendly = 'No puedes eliminar este ticket: solo el creador puede hacerlo.';
            } else if (path.includes('/api/tickets/') && path.endsWith('/move')) {
              friendly = 'No puedes mover este ticket: debes ser el asignado y contar con permiso.';
            }
          }
          const apiMsg = err.error?.error?.message;
          const msg = friendly ?? (typeof apiMsg === 'string' && apiMsg.trim() ? apiMsg : 'Ocurrió un error al procesar la solicitud.');
          toast.add({ severity: friendly ? 'warn' : 'error', summary: friendly ? 'Acción no permitida' : `Error ${err.status}`, detail: msg, life: 4500 });
        }
      }
      return throwError(() => err);
    }),
  );
};

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimations(),
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authCredentialsInterceptor, apiErrorToastInterceptor, auth401Interceptor])),
    providePrimeNG({
      theme: {
        preset: Aura
      }
    }),
    MessageService,
    ConfirmationService,
  ]
};
