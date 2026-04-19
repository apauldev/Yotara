import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PageHeaderComponent } from './page-header.component';

@Component({
  standalone: true,
  imports: [PageHeaderComponent],
  template: `
    <app-page-header title="Inbox" subtitle="Collect what matters">
      <button page-header-actions type="button">New task</button>
    </app-page-header>
  `,
})
class PageHeaderHostComponent {}

describe('PageHeaderComponent', () => {
  let fixture: ComponentFixture<PageHeaderHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PageHeaderHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PageHeaderHostComponent);
  });

  it('renders the title, subtitle, and projected actions', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Inbox');
    expect(fixture.nativeElement.textContent).toContain('Collect what matters');
    expect(
      fixture.debugElement.query(By.css('[page-header-actions]')).nativeElement.textContent,
    ).toContain('New task');
  });
});
