import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
    AppSvgIconComponent,
    ButtonComponent,
    CustomInputComponent,
    PasswordStrengthComponent,
    ValidationErrorsComponent,
} from '@shared/components';
import { timer } from 'rxjs';

type DialogStep = 'verify' | 'new-password';

@Component({
    selector: 'app-password-change-dialog',
    templateUrl: './password-change-dialog.component.html',
    styleUrls: ['./password-change-dialog.component.scss'],
    imports: [
        ReactiveFormsModule,
        AppSvgIconComponent,
        ButtonComponent,
        CustomInputComponent,
        PasswordStrengthComponent,
        ValidationErrorsComponent,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PasswordChangeDialogComponent {
    private readonly dialogRef = inject(DialogRef<boolean>);
    private readonly destroyRef = inject(DestroyRef);

    readonly step = signal<DialogStep>('verify');
    readonly loading = signal(false);
    readonly serverError = signal<string | null>(null);

    readonly currentPasswordControl = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
    });

    //TODO add validators as in sign up page
    readonly newPasswordControl = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
    });

    //TODO add validators as in sign up page
    readonly confirmPasswordControl = new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
    });

    get newPassword(): string {
        return this.newPasswordControl.getRawValue();
    }

    get passwordsMatch(): boolean {
        return this.newPassword === this.confirmPasswordControl.getRawValue();
    }

    onVerify(): void {
        this.currentPasswordControl.markAsTouched();
        if (this.currentPasswordControl.invalid) return;

        this.loading.set(true);
        this.serverError.set(null);
        // TODO: replace with authService.verifyPassword(currentPassword)
        timer(600)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.loading.set(false);
                this.step.set('new-password');
            });
    }

    onSubmit(): void {
        this.newPasswordControl.markAsTouched();
        this.confirmPasswordControl.markAsTouched();
        if (this.newPasswordControl.invalid || this.confirmPasswordControl.invalid) return;

        if (!this.passwordsMatch) {
            this.serverError.set('Passwords do not match.');
            return;
        }

        this.loading.set(true);
        this.serverError.set(null);
        // TODO: replace with authService.changePassword(currentPassword, newPassword)
        timer(800)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.loading.set(false);
                this.dialogRef.close(true);
            });
    }

    onCancel(): void {
        this.dialogRef.close(false);
    }
}
