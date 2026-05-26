import { inject, Injectable } from '@angular/core';

import { ConfigureModelsDialogService } from '../../../features/configure-models/services/configure-models-dialog.service';
import { createQuickStartTourSteps } from './quickstart-tour-steps';
import { TourPreferencesService } from './tour-preferences.service';

type ShepherdTourCtor = new (options: Record<string, unknown>) => ShepherdTourInstance;

interface ShepherdModule {
    Tour?: ShepherdTourCtor;
    default?: { Tour?: ShepherdTourCtor } | ShepherdTourCtor;
}

interface ShepherdTourInstance {
    addStep(step: Record<string, unknown>): void;
    start(): void;
    cancel(): void;
    complete(): void;
    on(event: 'complete' | 'cancel', handler: () => void): void;
    isActive(): boolean;
}

@Injectable({
    providedIn: 'root',
})
export class TourService {
    private readonly configureModelsDialogService = inject(ConfigureModelsDialogService);
    private readonly tourPreferencesService = inject(TourPreferencesService);

    private activeTour: ShepherdTourInstance | null = null;

    public async startQuickStartTour(): Promise<void> {
        if (this.activeTour?.isActive()) {
            return;
        }

        const TourCtor = await this.loadShepherdConstructor();
        const tour = new TourCtor({
            useModalOverlay: true,
            defaultStepOptions: {
                cancelIcon: { enabled: true },
                scrollTo: { behavior: 'smooth', block: 'center' },
                classes: 'shepherd-quickstart',
            },
        });

        const steps = createQuickStartTourSteps({
            configureModelsDialogService: this.configureModelsDialogService,
        });
        for (const step of steps) {
            tour.addStep(step as unknown as Record<string, unknown>);
        }

        const finalize = (): void => {
            this.activeTour = null;
            document.body.classList.remove('tour-active');
            this.configureModelsDialogService.close();
            this.tourPreferencesService.markQuickStartTourCompleted().subscribe();
        };
        tour.on('complete', finalize);
        tour.on('cancel', finalize);

        this.activeTour = tour;
        document.body.classList.add('tour-active');
        tour.start();
    }

    public endActiveTour(): void {
        this.activeTour?.cancel();
        this.activeTour = null;
    }

    private async loadShepherdConstructor(): Promise<ShepherdTourCtor> {
        // Lazy import — keeps shepherd.js out of the initial bundle.
        const mod = (await import('shepherd.js')) as unknown as ShepherdModule;
        if (mod.Tour) return mod.Tour;
        const def = mod.default;
        if (typeof def === 'function') return def;
        if (def?.Tour) return def.Tour;
        throw new Error('shepherd.js Tour constructor not found in module');
    }
}
