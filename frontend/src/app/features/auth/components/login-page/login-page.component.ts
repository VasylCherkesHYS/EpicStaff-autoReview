import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    effect,
    EffectRef,
    inject,
    Injector,
    signal,
    viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
    AppSvgIconComponent,
    ButtonComponent,
    CheckboxComponent,
    CustomInputComponent,
    ValidationErrorsComponent,
} from '@shared/components';
import { ServerErrorsDirective } from '@shared/directives';
import { strictEmailValidator } from '@shared/form-validators';
import { ApiErrorItem } from '@shared/models';
import { interval, take } from 'rxjs';

import { AuthService } from '../../../../services/auth/auth.service';

@Component({
    selector: 'app-login-page',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        CustomInputComponent,
        ValidationErrorsComponent,
        ButtonComponent,
        CheckboxComponent,
        AppSvgIconComponent,
        ServerErrorsDirective,
    ],
    templateUrl: './login-page.component.html',
    styleUrls: ['./login-page.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPageComponent {
    private serverErrors = viewChild<ServerErrorsDirective>('serverErrors');

    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);

    readonly form = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, strictEmailValidator()] }),
        password: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required],
        }),
        rememberMe: new FormControl(false, { nonNullable: true }),
    });

    readonly loading = signal(false);
    readonly throttleSecondsLeft = signal(0);

    private applyServerErrorsWhenReady(errors: ApiErrorItem[]): void {
        const ref: { current: EffectRef | null } = { current: null };
        ref.current = effect(
            () => {
                const dir = this.serverErrors();
                if (dir) {
                    dir.setErrors(errors);
                    ref.current?.destroy();
                }
            },
            { injector: this.injector }
        );
    }

    onSubmit(): void {
        this.form.markAllAsTouched();
        // if (this.form.invalid) return;

        this.loading.set(true);
        this.serverErrors()?.clear();

        const { email, password, rememberMe } = this.form.getRawValue();

        this.authService
            .login(email, password, rememberMe)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/projects';
                    void this.router.navigateByUrl(returnUrl);
                },
                error: (err: HttpErrorResponse) => {
                    this.loading.set(false);
                    if (err.status === 429) {
                        this.handleThrottleError(err.error?.message);
                        return;
                    }
                    if (err.validationErrors?.length) {
                        this.applyServerErrorsWhenReady(err.validationErrors);
                        return;
                    }
                    // Login failure on bad credentials — show as form-level error.
                    this.applyServerErrorsWhenReady([
                        { field: '', value: '', reason: err.error?.message ?? 'Login failed. Please try again.' },
                    ]);
                },
                complete: () => {
                    this.loading.set(false);
                },
            });
    }

    handleThrottleError(message: string): void {
        const seconds = Math.ceil(parseFloat(message.split(':')[1]) || 0);
        this.throttleSecondsLeft.set(seconds);

        interval(1000)
            .pipe(take(seconds), takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => this.throttleSecondsLeft.update((v) => v - 1),
                complete: () => this.throttleSecondsLeft.set(0),
            });
    }

    navToSignUp(): void {
        void this.router.navigateByUrl('sign-up');
    }
}
