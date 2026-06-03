import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '../../services/notifications';

export const forbiddenInterceptor: HttpInterceptorFn = (req, next) => {
    const toast = inject(ToastService);

    return next(req).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 403) {
                const message = err.error?.message ?? "You don't have permission to perform this action.";
                toast.error(message);
            }
            return throwError(() => err);
        })
    );
};
