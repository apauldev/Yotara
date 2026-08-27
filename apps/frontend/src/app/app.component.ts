import { AfterViewInit, ChangeDetectionStrategy, Component, NgZone, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Removes the static boot skeleton (see src/index.html) once the router has
 * rendered its first real page, so the skeleton never covers app content.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css',
})
export class AppComponent implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  constructor() {
    // Fallback: if navigation somehow never completes, don't leave a full-page
    // shimmer covering the app forever.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.removeSkeleton());
  }

  ngAfterViewInit(): void {
    // Safety net for aborted/failed first navigation: give any rejected
    // navigation a brief grace period before force-removing the skeleton.
    this.zone.runOutsideAngular(() => {
      setTimeout(() => this.removeSkeleton(), 4000);
    });
  }

  private removeSkeleton(): void {
    document.getElementById('boot-skeleton')?.remove();
  }
}
