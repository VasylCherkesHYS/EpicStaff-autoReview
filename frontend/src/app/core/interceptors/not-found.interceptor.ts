import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpStatus } from '@shared/models';
import { catchError, throwError } from 'rxjs';

export const notFoundInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
    const router = inject(Router);

    return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === HttpStatus.NotFound) {
                void router.navigate(['/not-found']);
            }
            return throwError(() => err);
        })
    );
};
