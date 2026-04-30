import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AppSvgIconComponent } from '../../shared/components/app-svg-icon/app-svg-icon.component';
import { SpinnerComponent } from '../../shared/components/spinner/spinner.component';
import { ReportsApiService, ReportsData } from './reports-api.service';

const STATUS_LABELS: Record<string, string> = {
    end: 'Completed',
    run: 'Running',
    error: 'Error',
    wait_for_user: 'Waiting',
    pending: 'Pending',
    stop: 'Stopped',
    expired: 'Expired',
};

const STATUS_COLORS: Record<string, string> = {
    end: '#2ABA6B',
    run: '#685FFF',
    error: '#FF4D6A',
    wait_for_user: '#F0A500',
    pending: '#7B8FA1',
    stop: '#9E9E9E',
    expired: '#BFC0C3',
};

export interface DonutSlice {
    key: string;
    label: string;
    count: number;
    percent: number;
    color: string;
    offset: number;
}

@Component({
    selector: 'app-reports-page',
    standalone: true,
    imports: [CommonModule, RouterLink, AppSvgIconComponent, SpinnerComponent],
    templateUrl: './reports-page.component.html',
    styleUrl: './reports-page.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPageComponent implements OnInit {
    private reportsApi = inject(ReportsApiService);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);

    data: ReportsData | null = null;
    isLoading = true;
    hasError = false;

    donutSlices: DonutSlice[] = [];
    donutTotal = 0;

    ngOnInit(): void {
        this.reportsApi.loadReports().subscribe({
            next: (d) => {
                this.data = d;
                this.donutSlices = this.buildDonutSlices(d.statusCounts);
                this.donutTotal = d.totalSessions;
                this.isLoading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.hasError = true;
                this.isLoading = false;
                this.cdr.markForCheck();
            },
        });
    }

    formatDuration(ms: number): string {
        if (!ms) return '—';
        const s = Math.floor(ms / 1000);
        if (s < 60) return `${s}s`;
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
    }

    formatTokens(n: number): string {
        if (!n) return '0';
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return `${n}`;
    }

    formatCost(usd: number): string {
        if (!usd) return '—';
        if (usd < 0.0001) return '< $0.0001';
        if (usd < 0.01) return `$${usd.toFixed(4)}`;
        if (usd < 1) return `$${usd.toFixed(3)}`;
        if (usd < 100) return `$${usd.toFixed(2)}`;
        return `$${usd.toFixed(0)}`;
    }

    getStatusLabel(key: string): string {
        return STATUS_LABELS[key] ?? key;
    }

    getStatusColor(key: string): string {
        return STATUS_COLORS[key] ?? '#7B8FA1';
    }

    private buildDonutSlices(counts: Record<string, number>): DonutSlice[] {
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        if (total === 0) return [];

        const circumference = 2 * Math.PI * 40;
        let offset = 0;

        return Object.entries(counts)
            .filter(([, c]) => c > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([key, count]) => {
                const percent = count / total;
                const slice: DonutSlice = {
                    key,
                    label: STATUS_LABELS[key] ?? key,
                    count,
                    percent,
                    color: STATUS_COLORS[key] ?? '#7B8FA1',
                    offset: circumference * (1 - offset),
                };
                offset += percent;
                return slice;
            });
    }

    get donutCircumference(): number {
        return 2 * Math.PI * 40;
    }

    get barMaxCount(): number {
        return this.data?.topFlows[0]?.count ?? 1;
    }

    navigateToFlow(graphId: number): void {
        this.router.navigate(['/flows', graphId]);
    }
}
