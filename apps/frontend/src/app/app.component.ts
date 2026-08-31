import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Default,
  styleUrl: './app.component.css',
})
export class AppComponent {
  /** Eagerly instantiate ThemeService so the theme class is applied to
   *  <html> on every page (including login), not just after navigating
   *  into the personal shell. */
  private readonly theme = inject(ThemeService);
}
