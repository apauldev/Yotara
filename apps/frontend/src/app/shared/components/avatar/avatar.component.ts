import { Component, ChangeDetectionStrategy, computed, inject, input } from '@angular/core';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

import { toSafeAvatarImage } from '../../utils/avatar';
import { getInitials } from '../../utils/initials';

export type AvatarSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-avatar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <span
      class="app-avatar"
      [class.app-avatar-sm]="size() === 'sm'"
      [class.app-avatar-lg]="size() === 'lg'"
      [attr.role]="decorative() ? null : 'img'"
      [attr.aria-label]="decorative() ? null : label()"
    >
      @if (safeImageSrc(); as src) {
        <img class="app-avatar-image" [src]="src" alt="" aria-hidden="true" />
      } @else {
        <span class="app-avatar-initials" aria-hidden="true">{{ initials() }}</span>
      }
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }

      .app-avatar {
        width: 2.7rem;
        height: 2.7rem;
        border-radius: 999px;
        background: var(--primary-soft);
        color: var(--primary-solid);
        display: grid;
        place-items: center;
        font-size: 0.92rem;
        font-weight: 700;
        flex: 0 0 auto;
        overflow: hidden;
      }

      .app-avatar-sm {
        width: 2rem;
        height: 2rem;
        font-size: 0.72rem;
      }

      .app-avatar-lg {
        width: 3.5rem;
        height: 3.5rem;
        font-size: 1.15rem;
      }

      .app-avatar-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
    `,
  ],
})
export class AvatarComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly image = input<string | null | undefined>(null);
  readonly name = input<string | null | undefined>(null);
  readonly email = input<string | null | undefined>(null);
  readonly size = input<AvatarSize>('md');
  readonly decorative = input<boolean>(true);

  protected readonly initials = computed(() => getInitials(this.name(), this.email()));

  protected readonly label = computed(
    () => this.name()?.trim() || this.email()?.trim() || 'Avatar',
  );

  protected readonly safeImageSrc = computed((): SafeResourceUrl | null => {
    const safeImage = toSafeAvatarImage(this.image());
    if (!safeImage) {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(safeImage);
  });
}
