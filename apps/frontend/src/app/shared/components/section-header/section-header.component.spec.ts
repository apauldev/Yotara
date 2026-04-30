import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { SectionHeaderComponent } from './section-header.component';

@Component({
  standalone: true,
  imports: [SectionHeaderComponent],
  template: `
    <app-section-header title="Inbox" count="12 tasks" size="sm" tone="accent">
      <button section-header-actions type="button">Filter</button>
    </app-section-header>
  `,
})
class SectionHeaderHostComponent {}

describe('SectionHeaderComponent', () => {
  let fixture: ComponentFixture<SectionHeaderHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectionHeaderHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SectionHeaderHostComponent);
  });

  it('renders the title, count, and projected actions', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Inbox');
    expect(fixture.nativeElement.textContent).toContain('12 tasks');
    expect(
      fixture.debugElement.query(By.css('[section-header-actions]')).nativeElement.textContent,
    ).toContain('Filter');
  });
});
