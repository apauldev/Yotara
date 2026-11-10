import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { ImageCropperComponent, type ImageCroppedEvent } from 'ngx-image-cropper';
import { ModalComponent } from '../../ui/modal/modal.component';
import {
  AVATAR_ACCEPT,
  isAvatarWithinLimits,
  toAvatarDataUrl,
  validateAvatarFile,
} from '../../utils/avatar';
import { AvatarComponent } from './avatar.component';

/**
 * Reusable profile-photo editor. The original file never leaves the browser:
 * `ngx-image-cropper` crops square, resizes to 256×256, and emits a WebP data
 * URL (PNG/JPEG when the browser cannot encode WebP). The parent owns saving.
 */
@Component({
  selector: 'app-avatar-editor',
  standalone: true,
  imports: [AvatarComponent, ImageCropperComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-modal
      [open]="open()"
      title="Profile photo"
      size="sm"
      [showFooter]="false"
      [closeOnBackdrop]="!saving()"
      [closeOnEsc]="!saving()"
      (close)="onClose()"
    >
      <div class="avatar-editor">
        @if (!imageFile()) {
          <div class="preview-row">
            <app-avatar [image]="currentImage()" [name]="userName()" size="lg" />
            <div class="preview-copy">
              <strong>Choose a photo</strong>
              <span>JPEG, PNG, or WebP under 5 MB.</span>
            </div>
          </div>

          <label class="file-button">
            Choose a photo
            <input type="file" [accept]="accept" data-autofocus (change)="onFileSelected($event)" />
          </label>
        } @else {
          <div class="cropper-stage">
            <image-cropper
              [imageFile]="imageFile()"
              [maintainAspectRatio]="true"
              [aspectRatio]="1"
              [containWithinAspectRatio]="true"
              [resizeToWidth]="256"
              [resizeToHeight]="256"
              [output]="'base64'"
              [format]="'webp'"
              [imageQuality]="82"
              [autoCrop]="true"
              [imageAltText]="'Profile photo crop preview'"
              [cropperFrameAriaLabel]="'Crop your profile photo'"
              (imageCropped)="onImageCropped($event)"
              (imageLoaded)="onImageLoaded()"
              (loadImageFailed)="onLoadFailed()"
            />
          </div>

          <label class="file-button file-button-quiet">
            Choose another photo
            <input type="file" [accept]="accept" (change)="onFileSelected($event)" />
          </label>
        }

        @if (displayError(); as message) {
          <p class="editor-error" role="alert">{{ message }}</p>
        }

        <p class="editor-help">
          Use the arrow keys to move the crop area. Your photo stays in this browser until you save.
        </p>

        <div class="editor-footer">
          @if (currentImage()) {
            <button
              type="button"
              class="remove-button"
              [disabled]="saving()"
              (click)="remove.emit()"
            >
              Remove photo
            </button>
          }
          <span class="spacer"></span>
          <button type="button" class="secondary-button" [disabled]="saving()" (click)="onClose()">
            Cancel
          </button>
          <button type="button" class="primary-button" [disabled]="!canSave()" (click)="onSave()">
            {{ saving() ? 'Saving...' : 'Save photo' }}
          </button>
        </div>
      </div>
    </app-modal>
  `,
  styles: [
    `
      :host {
        display: contents;
      }

      .avatar-editor {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }

      .preview-row {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }

      .preview-copy {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        min-width: 0;
      }

      .preview-copy strong {
        font-size: 1rem;
      }

      .preview-copy span {
        color: var(--on-surface-muted);
        font-size: 0.88rem;
        line-height: 1.4;
      }

      .file-button {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.7rem 1.1rem;
        border-radius: 999px;
        background: var(--primary-soft);
        color: var(--primary-solid);
        font-size: 0.95rem;
        font-weight: 650;
        cursor: pointer;
        overflow: hidden;
      }

      .file-button input {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
      }

      .file-button:focus-within {
        outline: 2px solid var(--primary-solid);
        outline-offset: 2px;
      }

      .file-button-quiet {
        background: var(--surface-container-low);
        color: var(--on-surface);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .cropper-stage {
        width: min(20rem, 100%);
        min-height: 200px;
        max-height: min(340px, 50dvh);
        height: auto;
        box-sizing: border-box;
        margin-inline: auto;
        border-radius: 1rem;
        overflow: hidden;
        background: var(--surface-container-low);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        /*
         * Establish a touch-action context so the browser doesn't
         * intercept pointer events before the cropper can handle them.
         */
        touch-action: none;
      }

      image-cropper {
        display: block;
        width: 100%;
        height: auto;
      }

      .editor-error {
        margin: 0;
        color: var(--status-overdue);
        font-size: 0.9rem;
        font-weight: 600;
      }

      .editor-help {
        margin: 0;
        color: var(--on-surface-subtle);
        font-size: 0.82rem;
        line-height: 1.4;
      }

      .editor-footer {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        flex-wrap: wrap;
        padding-top: 0.3rem;
      }

      .spacer {
        flex: 1;
      }

      .primary-button,
      .secondary-button,
      .remove-button {
        border: 0;
        border-radius: 999px;
        font: inherit;
        font-size: 0.92rem;
        font-weight: 650;
        padding: 0.65rem 1.15rem;
        cursor: pointer;
      }

      .primary-button {
        background: var(--primary-gradient);
        color: hsl(var(--primary-foreground));
      }

      .primary-button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      .secondary-button {
        background: var(--surface-container-low);
        color: var(--on-surface);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
      }

      .remove-button {
        background: transparent;
        color: var(--status-overdue);
        padding-left: 0.2rem;
      }

      .secondary-button:disabled,
      .remove-button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      @media (width <= 640px) {
        .cropper-stage {
          width: 100%;
          max-width: 16rem;
          min-height: 160px;
          max-height: min(240px, 36dvh);
        }

        .file-button {
          width: 100%;
        }

        .editor-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .remove-button {
          width: 100%;
          text-align: center;
          padding: 0.35rem 0.5rem;
          order: -1;
        }

        .secondary-button,
        .primary-button {
          flex: 1 1 0;
          text-align: center;
          padding: 0.65rem 0.75rem;
        }

        .spacer {
          display: none;
        }
      }
    `,
  ],
})
export class AvatarEditorComponent {
  readonly open = input(false);
  readonly currentImage = input<string | null>(null);
  readonly userName = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly saving = input(false);

  readonly save = output<string>();
  readonly remove = output<void>();
  readonly close = output<void>();

  protected readonly accept = AVATAR_ACCEPT;
  protected readonly imageFile = signal<File | undefined>(undefined);
  protected readonly croppedDataUrl = signal<string | null>(null);
  protected readonly localError = signal<string | null>(null);
  protected readonly displayError = computed(() => this.localError() ?? this.error());
  protected readonly canSave = computed(
    () => this.croppedDataUrl() !== null && !this.displayError() && !this.saving(),
  );

  constructor() {
    effect(() => {
      if (this.open()) {
        this.imageFile.set(undefined);
        this.croppedDataUrl.set(null);
        this.localError.set(null);
      }
    });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';

    if (!file) {
      return;
    }

    const error = validateAvatarFile(file);
    if (error) {
      this.imageFile.set(undefined);
      this.croppedDataUrl.set(null);
      this.localError.set(error);
      return;
    }

    this.localError.set(null);
    this.croppedDataUrl.set(null);
    this.imageFile.set(file);
  }

  protected onImageLoaded(): void {
    this.localError.set(null);
  }

  protected onImageCropped(event: ImageCroppedEvent): void {
    const base64 = event.base64 ?? '';
    if (!base64) {
      // The cropper emits once before the image is ready; wait for a real crop.
      return;
    }

    const dataUrl = toAvatarDataUrl(base64);
    if (!dataUrl) {
      this.croppedDataUrl.set(null);
      this.localError.set('Could not read that image. Choose a JPEG or PNG.');
      return;
    }

    if (!isAvatarWithinLimits(dataUrl)) {
      this.croppedDataUrl.set(null);
      this.localError.set('That photo is too large. Choose a smaller or simpler image.');
      return;
    }

    this.localError.set(null);
    this.croppedDataUrl.set(dataUrl);
  }

  protected onLoadFailed(): void {
    this.imageFile.set(undefined);
    this.croppedDataUrl.set(null);
    this.localError.set('Could not read that image. Choose a JPEG or PNG.');
  }

  protected onSave(): void {
    const dataUrl = this.croppedDataUrl();
    if (dataUrl) {
      this.save.emit(dataUrl);
    }
  }

  protected onClose(): void {
    if (!this.saving()) {
      this.close.emit();
    }
  }
}
