import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStateService } from './core/services/auth-state.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  /** Eagerly instantiate ThemeService so the theme class is applied to
   *  <html> on every page (including login), not just after navigating
   *  into the personal shell. */
  private readonly theme = inject(ThemeService);
  private readonly authState = inject(AuthStateService);

  ngOnInit() {
    // Kick off auth initialization in the background — never block the first
    // paint on it. AuthStateService coalesces concurrent calls, so guards and
    // the root trigger share a single config/session request set.
    void this.authState.initialize();
  }
}
