import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import {
    AppSvgIconComponent,
    ButtonComponent,
    CustomInputComponent,
    PasswordStrengthComponent,
    ValidationErrorsComponent,
} from '@shared/components';
import { of, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';

type PageState = 'validating' | 'invalid-token' | 'set-password' | 'success';

@Component({
    selector: 'app-reset-password-page',
    templateUrl: './reset-password-page.component.html',
    styleUrls: ['../login-page/login-page.component.scss', './reset-password-page.component.scss'],
    imports: [
        ReactiveFormsModule,
        AppSvgIconComponent,
        ButtonComponent,
        CustomInputComponent,
        ValidationErrorsComponent,
        MatIconModule,
        PasswordStrengthComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPageComponent implements OnInit {
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    private token = '';

    readonly state = signal<PageState>('validating');
    readonly loading = signal(false);

    readonly passwordControl = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
    });

    constructor() {
        const route = inject(ActivatedRoute);
        this.token = route.snapshot.queryParamMap.get('token') ?? '';
    }

    ngOnInit(): void {
        if (!this.token) {
            this.state.set('invalid-token');
            return;
        }

        // TODO: replace with authService.validateResetToken(this.token)
        timer(600)
            .pipe(
                switchMap(() => of(true)), // mock: token is always valid
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: (valid) => this.state.set(valid ? 'set-password' : 'invalid-token'),
                error: () => this.state.set('invalid-token'),
            });
    }

    get password(): string {
        return this.passwordControl.getRawValue();
    }

    onSetPassword(): void {
        this.passwordControl.markAsTouched();
        if (this.passwordControl.invalid) return;

        this.loading.set(true);
        // TODO: replace with authService.resetPassword(this.token, password)
        timer(800)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.loading.set(false);
                this.state.set('success');
            });
    }

    navToLogin(): void {
        void this.router.navigate(['/login']);
    }
}
