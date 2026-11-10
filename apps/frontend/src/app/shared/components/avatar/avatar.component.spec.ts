import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AvatarComponent } from './avatar.component';

@Component({
  standalone: true,
  imports: [AvatarComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <app-avatar
      [image]="image"
      [decorative]="decorative"
      [name]="name"
      [email]="email"
      [size]="size"
    />
  `,
})
class AvatarHostComponent {
  image: string | null = null;
  decorative = true;
  name: string | null = 'Jordan Doe';
  email: string | null = 'jordan@example.com';
  size: 'sm' | 'md' | 'lg' = 'md';
}

describe('AvatarComponent', () => {
  let fixture: ComponentFixture<AvatarHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvatarHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AvatarHostComponent);
  });

  it('renders initials when no image is set', () => {
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.app-avatar-image'))).toBeNull();
    expect(
      fixture.debugElement.query(By.css('.app-avatar-initials')).nativeElement.textContent.trim(),
    ).toBe('JD');
  });

  it('renders the image when a safe data URL is set', () => {
    fixture.componentInstance.image = 'data:image/png;base64,iVBORw0KGgo=';
    fixture.detectChanges();

    const img = fixture.debugElement.query(By.css('.app-avatar-image'));
    expect(img).toBeTruthy();
    expect(img.nativeElement.getAttribute('src')).toContain('data:image/png;base64,');
    expect(fixture.debugElement.query(By.css('.app-avatar-initials'))).toBeNull();
  });

  it('falls back to initials for an unsafe image URL', () => {
    fixture.componentInstance.image = 'https://example.com/avatar.png';
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.app-avatar-image'))).toBeNull();
    expect(
      fixture.debugElement.query(By.css('.app-avatar-initials')).nativeElement.textContent.trim(),
    ).toBe('JD');
  });

  it('exposes the person name when used standalone', () => {
    fixture.componentInstance.decorative = false;
    fixture.detectChanges();

    const avatar = fixture.debugElement.query(By.css('.app-avatar'));
    expect(avatar.nativeElement.getAttribute('role')).toBe('img');
    expect(avatar.nativeElement.getAttribute('aria-label')).toBe('Jordan Doe');
  });

  it('falls back to email or Avatar for standalone label when name is missing', () => {
    fixture.componentInstance.decorative = false;
    fixture.componentInstance.name = null;
    fixture.detectChanges();

    const avatar = fixture.debugElement.query(By.css('.app-avatar'));
    expect(avatar.nativeElement.getAttribute('aria-label')).toBe('jordan@example.com');

    fixture.componentInstance.email = null;
    fixture.detectChanges();
    expect(avatar.nativeElement.getAttribute('aria-label')).toBe('Avatar');
  });

  it('applies sm and lg size classes correctly', () => {
    fixture.componentInstance.size = 'sm';
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.app-avatar-sm'))).toBeTruthy();

    fixture.componentInstance.size = 'lg';
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.app-avatar-lg'))).toBeTruthy();
  });
});
