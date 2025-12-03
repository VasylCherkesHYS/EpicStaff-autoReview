import { Component, OnInit, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { MATERIAL_FORMS } from '../../../../shared/material-forms';
import { DialogRef } from '@angular/cdk/dialog';
import { ErrorStateMatcher } from '@angular/material/core';
import { CustomErrorStateMatcher } from '../../../../shared/error-state-matcher/custom-error-state-matcher';
import { Project, ProjectProcess } from '../../models/project.model';
import { ProjectStore } from '../../services/project.store';

interface ProjectFormData {
    name: string;
    description: string;
    process: ProjectProcess;
    memory: boolean;
    cache: boolean;
  maxRpm: number;
  searchLimit: number;
  similarityThreshold: number;
}

@Component({
    selector: 'app-create-project',
    standalone: true,
    templateUrl: './create-project.component.html',
    styleUrls: ['./create-project.component.scss'],
    imports: [ReactiveFormsModule, ...MATERIAL_FORMS],
    changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: ErrorStateMatcher, useClass: CustomErrorStateMatcher }],
})
export class CreateProjectComponent implements OnInit {
  private readonly store = inject(ProjectStore);
  private readonly dialogRef = inject(DialogRef<Project | undefined>);

  isTemplate = true;
  isSubmitting = signal(false);
  ProjectProcess = ProjectProcess;

  projectForm!: FormGroup<{
        name: FormControl<string>;
        description: FormControl<string>;
        process: FormControl<ProjectProcess>;
        memory: FormControl<boolean>;
        cache: FormControl<boolean>;
    maxRpm: FormControl<number>;
    searchLimit: FormControl<number>;
    similarityThreshold: FormControl<number>;
    }>;

  constructor() {
        this.isTemplate = this.dialogRef.config.data?.isTemplate ?? true;
    }

    ngOnInit(): void {
        this.initializeForm();
    }

    private initializeForm(): void {
        this.projectForm = new FormGroup({
      name: new FormControl<string>('', { nonNullable: true, validators: Validators.required }),
      description: new FormControl<string>('', { nonNullable: true }),
      process: new FormControl<ProjectProcess>(ProjectProcess.SEQUENTIAL, {
        nonNullable: true,
        validators: Validators.required,
      }),
      memory: new FormControl<boolean>(false, { nonNullable: true }),
      cache: new FormControl<boolean>(false, { nonNullable: true }),
      maxRpm: new FormControl<number>(15, {
        nonNullable: true,
        validators: [Validators.min(1), Validators.max(50)],
      }),
      searchLimit: new FormControl<number>(10, {
        nonNullable: true,
        validators: [Validators.min(1), Validators.max(1000)],
      }),
      similarityThreshold: new FormControl<number>(0.7, {
        nonNullable: true,
        validators: [Validators.min(0.0), Validators.max(1.0)],
      }),
    });
    }

  get nameField() {
        return this.projectForm.controls.name;
    }

  get maxRpmField() {
    return this.projectForm.controls.maxRpm;
    }

  get searchLimitField() {
    return this.projectForm.controls.searchLimit;
    }

  get thresholdField() {
    return this.projectForm.controls.similarityThreshold;
    }

    formatRpmLabel(value: number): string {
        return `${value}`;
    }

    formatSearchLimitLabel(value: number): string {
        return `${value}`;
    }

    formatThresholdLabel(value: number): string {
        return `${value}`;
    }

    onSubmit(): void {
    if (this.projectForm.invalid || this.isSubmitting()) return;

        this.isSubmitting.set(true);
    const form = this.projectForm.getRawValue();

    const project = new Project(
      0,
      form.name,
      form.description || null,
      form.process,
      [],
      [],
      [],
      form.memory,
      null,
      form.maxRpm,
      form.cache,
      false,
      null,
      false,
      form.similarityThreshold.toString(),
      form.searchLimit,
      null,
      null,
      null,
      null,
      null,
      this.isTemplate
    );

    this.store.create(project).subscribe({
      next: (created) => {
                    this.isSubmitting.set(false);
        this.dialogRef.close(created);
                },
      error: (err) => {
        console.error('Error creating project:', err);
                    this.isSubmitting.set(false);
                },
            });
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
