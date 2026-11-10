import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AvatarEditorComponent } from './avatar-editor.component';

@Component({
  standalone: true,
  imports: [AvatarEditorComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-avatar-editor
      [open]="open"
      [currentImage]="currentImage"
      [userName]="userName"
      [error]="error"
      [saving]="saving"
      (save)="savedImage = $event"
      (remove)="removed = true"
      (close)="closed = true"
    />
  `,
})
class AvatarEditorHostComponent {
  open = true;
  currentImage: string | null = null;
  userName = 'Jordan Doe';
  error: string | null = null;
  saving = false;

  savedImage: string | null = null;
  removed = false;
  closed = false;
}

describe('AvatarEditorComponent', () => {
  let fixture: ComponentFixture<AvatarEditorHostComponent>;
  let host: AvatarEditorHostComponent;
  let editor: AvatarEditorComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarEditorHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarEditorHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    editor = fixture.debugElement.query(By.directive(AvatarEditorComponent)).componentInstance;
  });

  it('renders modal with title and preview row when open', () => {
    const title = fixture.debugElement.query(By.css('h2'));
    expect(title?.nativeElement.textContent.trim()).toBe('Profile photo');
  });

  it('validates selected file type and size', () => {
    const invalidFile = new File(['<svg/>'], 'avatar.svg', { type: 'image/svg+xml' });
    const event = {
      target: {
        files: [invalidFile],
        value: 'dummy',
      },
    } as unknown as Event;

    (editor as any).onFileSelected(event);
    fixture.detectChanges();

    expect((editor as any).displayError()).toBe('Choose a JPEG, PNG, or WebP image.');

    // No file selected
    (editor as any).onFileSelected({ target: { files: [], value: '' } } as unknown as Event);
    expect((editor as any).displayError()).toBe('Choose a JPEG, PNG, or WebP image.');

    // Valid file
    const validFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'avatar.png', {
      type: 'image/png',
    });
    (editor as any).onFileSelected({
      target: { files: [validFile], value: '' },
    } as unknown as Event);
    fixture.detectChanges();

    expect((editor as any).displayError()).toBeNull();
    expect((editor as any).imageFile()).toBe(validFile);
  });

  it('handles image loaded, load failed, and cropped events', () => {
    // imageLoaded clears error
    (editor as any).localError.set('Some error');
    (editor as any).onImageLoaded();
    expect((editor as any).localError()).toBeNull();

    // onLoadFailed sets error and resets file
    (editor as any).onLoadFailed();
    expect((editor as any).localError()).toBe('Could not read that image. Choose a JPEG or PNG.');
    expect((editor as any).imageFile()).toBeUndefined();

    // onImageCropped with empty base64 does nothing
    (editor as any).onImageCropped({ base64: '' });
    expect((editor as any).croppedDataUrl()).toBeNull();

    // onImageCropped with valid png
    const pngBase64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    (editor as any).onImageCropped({ base64: `data:image/png;base64,${pngBase64}` });
    expect((editor as any).croppedDataUrl()).toContain('data:image/png;base64,');
    expect((editor as any).canSave()).toBeTrue();

    // onImageCropped with unreadable/invalid url
    (editor as any).onImageCropped({ base64: 'data:image/svg+xml;base64,PHN2Zz4=' });
    expect((editor as any).localError()).toBe('Could not read that image. Choose a JPEG or PNG.');

    // onImageCropped with oversized url
    const oversizedBase64 = 'data:image/png;base64,' + 'A'.repeat(200_001);
    (editor as any).onImageCropped({ base64: oversizedBase64 });
    expect((editor as any).localError()).toBe(
      'That photo is too large. Choose a smaller or simpler image.',
    );
  });

  it('saves cropped dataUrl and emits save event', () => {
    const pngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    (editor as any).croppedDataUrl.set(pngBase64);
    (editor as any).onSave();

    expect(host.savedImage).toBe(pngBase64);
  });

  it('emits remove when remove button is clicked', () => {
    host.currentImage = 'data:image/png;base64,iVBORw0KGgo=';
    fixture.detectChanges();

    const removeBtn = fixture.debugElement.query(By.css('.remove-button'));
    expect(removeBtn).toBeTruthy();
    removeBtn.nativeElement.click();

    expect(host.removed).toBeTrue();
  });

  it('handles close properly unless saving is in progress', () => {
    (editor as any).onClose();
    expect(host.closed).toBeTrue();

    host.closed = false;
    host.saving = true;
    fixture.detectChanges();

    (editor as any).onClose();
    expect(host.closed).toBeFalse();
  });

  it('allows retrying after a save error and dismisses external error on user interaction', () => {
    const pngBase64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    (editor as any).croppedDataUrl.set(pngBase64);

    // Parent passes server error
    host.error = 'Could not save your photo. Please try again.';
    fixture.detectChanges();

    // canSave remains true so user can retry saving!
    expect((editor as any).displayError()).toBe('Could not save your photo. Please try again.');
    expect((editor as any).canSave()).toBeTrue();

    // User retries save
    host.savedImage = null;
    (editor as any).onSave();
    expect(host.savedImage as string | null).toBe(pngBase64);

    // Re-cropping dismisses the stale external error
    host.error = 'Could not save your photo. Please try again.';
    fixture.detectChanges();
    (editor as any).onImageCropped({ base64: pngBase64 });
    expect((editor as any).displayError()).toBeNull();
  });
});
