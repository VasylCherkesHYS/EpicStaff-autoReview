import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';

import { ConfigureModelsDialogService } from '../../../features/configure-models/services/configure-models-dialog.service';

export interface QuickStartTourDeps {
    configureModelsDialogService: ConfigureModelsDialogService;
}

interface ShepherdTourInstance {
    next(): void;
    back(): void;
    cancel(): void;
    complete(): void;
}

interface ShepherdStepInstance {
    tour: ShepherdTourInstance;
}

export interface TourStepDefinition {
    id: string;
    title: string;
    text: string;
    attachTo?: { element: string; on: 'top' | 'bottom' | 'left' | 'right' };
    beforeShowPromise?: () => Promise<void>;
    advanceOn?: { selector: string; event: string };
    buttons: {
        text: string;
        classes?: string;
        action: (this: ShepherdTourInstance) => void;
    }[];
    when?: {
        show?: (this: ShepherdStepInstance) => void;
        hide?: (this: ShepherdStepInstance) => void;
    };
}

const DIALOG_OPEN_TIMEOUT_MS = 1500;

function waitForElement(selector: string, timeoutMs = DIALOG_OPEN_TIMEOUT_MS): Promise<void> {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) {
            resolve();
            return;
        }
        const start = performance.now();
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve();
                return;
            }
            if (performance.now() - start > timeoutMs) {
                observer.disconnect();
                resolve();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

export function createQuickStartTourSteps(deps: QuickStartTourDeps): TourStepDefinition[] {
    let settingsOpenSub: Subscription | null = null;
    let providerOptionClickHandler: ((event: Event) => void) | null = null;

    const nextButton = {
        text: 'Next',
        classes: 'shepherd-button-primary',
        action(this: ShepherdTourInstance) {
            this.next();
        },
    };

    const backButton = {
        text: 'Back',
        classes: 'shepherd-button-secondary',
        action(this: ShepherdTourInstance) {
            this.back();
        },
    };

    const skipButton = {
        text: 'Skip',
        classes: 'shepherd-button-secondary',
        action(this: ShepherdTourInstance) {
            this.cancel();
        },
    };

    return [
        {
            id: 'welcome',
            title: 'Welcome to EpicStaff',
            text: 'Let`s set up your first AI models so you can start building. It takes under a minute.',
            buttons: [skipButton, { ...nextButton, text: 'Get started' }],
        },
        {
            id: 'sidenav-settings',
            title: 'Open Settings',
            text: 'Click the Settings icon to manage your model configuration.',
            attachTo: { element: '[data-tour="sidenav-settings"]', on: 'right' },
            when: {
                show(this: ShepherdStepInstance) {
                    settingsOpenSub?.unsubscribe();
                    if (deps.configureModelsDialogService.isOpen()) {
                        queueMicrotask(() => this.tour.next());
                        return;
                    }
                    settingsOpenSub = deps.configureModelsDialogService.opened$
                        .pipe(take(1))
                        .subscribe(() => this.tour.next());
                },
                hide() {
                    settingsOpenSub?.unsubscribe();
                    settingsOpenSub = null;
                },
            },
            buttons: [
                backButton,
                {
                    text: 'Next',
                    classes: 'shepherd-button-primary',
                    action() {
                        deps.configureModelsDialogService.open();
                    },
                },
            ],
        },
        {
            id: 'quickstart-tab',
            title: 'Quick Start',
            text: 'Quick Start is the fastest way to get going — it sets up sensible defaults for you.',
            attachTo: { element: '[data-tour="quickstart-tab"]', on: 'bottom' },
            beforeShowPromise: () => waitForElement('[data-tour="quickstart-tab"]'),
            buttons: [
                {
                    text: 'Back',
                    classes: 'shepherd-button-secondary',
                    action(this: ShepherdTourInstance) {
                        deps.configureModelsDialogService.close();
                        this.back();
                    },
                },
                nextButton,
            ],
        },
        {
            id: 'quickstart-provider',
            title: 'Pick a provider',
            text: 'Click the dropdown to choose your AI provider — OpenAI, Gemini, Cohere, or Mistral.',
            attachTo: { element: '[data-tour="quickstart-provider"]', on: 'right' },
            beforeShowPromise: () => waitForElement('[data-tour="quickstart-provider"]'),
            advanceOn: { selector: '[data-tour="quickstart-provider"] button', event: 'click' },
            buttons: [backButton],
        },
        {
            id: 'quickstart-provider-list',
            title: 'Select a provider',
            text: 'Pick one from the list to continue.',
            attachTo: { element: '.selector__dropdown', on: 'right' },
            beforeShowPromise: () => {
                if (!document.querySelector('.selector__dropdown')) {
                    document.querySelector<HTMLButtonElement>('[data-tour="quickstart-provider"] button')?.click();
                }
                return waitForElement('.selector__dropdown');
            },
            when: {
                show(this: ShepherdStepInstance) {
                    const tour = this.tour;
                    providerOptionClickHandler = (event: Event) => {
                        const target = event.target as HTMLElement | null;
                        if (target?.closest('.selector__option')) {
                            tour.next();
                        }
                    };
                    document.addEventListener('click', providerOptionClickHandler, true);
                },
                hide() {
                    if (providerOptionClickHandler) {
                        document.removeEventListener('click', providerOptionClickHandler, true);
                        providerOptionClickHandler = null;
                    }
                },
            },
            buttons: [backButton],
        },
        {
            id: 'quickstart-api-key',
            title: 'Add your API key',
            text: 'Paste your provider API key. It is kept private and used only to talk to the provider.',
            attachTo: { element: '[data-tour="quickstart-api-key"]', on: 'bottom' },
            beforeShowPromise: () => waitForElement('[data-tour="quickstart-api-key"]'),
            buttons: [backButton, nextButton],
        },
        {
            id: 'quickstart-activate',
            title: 'Activate',
            text: 'Click Activate to create your default LLM, embedding and transcription configs.',
            attachTo: { element: '[data-tour="quickstart-activate"]', on: 'top' },
            beforeShowPromise: () => waitForElement('[data-tour="quickstart-activate"]'),
            buttons: [
                backButton,
                {
                    text: 'Got it',
                    classes: 'shepherd-button-primary',
                    action(this: ShepherdTourInstance) {
                        deps.configureModelsDialogService.close();
                        this.next();
                    },
                },
            ],
        },
        {
            id: 'done',
            title: 'You`re all set',
            text: 'When you`re ready, head to Projects to start building with your new models.',
            buttons: [
                {
                    text: 'Finish',
                    classes: 'shepherd-button-primary',
                    action(this: ShepherdTourInstance) {
                        this.complete();
                    },
                },
            ],
        },
    ];
}
