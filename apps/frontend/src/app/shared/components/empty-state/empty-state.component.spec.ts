import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faStar } from '@fortawesome/free-solid-svg-icons';
import { By } from '@angular/platform-browser';
import { EmptyStateComponent } from './empty-state.component';

@Component({
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <app-empty-state [title]="title" [description]="description" [icon]="icon">
      <button empty-state-actions type="button">Action Button</button>
    </app-empty-state>
  `,
})
class EmptyStateHostComponent {
  title = '';
  description = '';
  icon?: any;
}

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateHostComponent>;
  let hostComponent: EmptyStateHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmptyStateHostComponent);
    hostComponent = fixture.componentInstance;
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title and description', () => {
    hostComponent.title = 'No tasks yet';
    hostComponent.description = 'Start adding tasks to see them here.';
    fixture.detectChanges();

    const element = fixture.nativeElement;
    expect(element.textContent).toContain('No tasks yet');
    expect(element.textContent).toContain('Start adding tasks to see them here.');
  });

  it('should render the default orb when no icon is provided', () => {
    fixture.detectChanges();

    const orb = fixture.debugElement.query(By.css('.empty-orb'));
    expect(orb).toBeTruthy();
    expect(orb.nativeElement.textContent.trim()).toBe('+');
  });

  it('should not render the default orb when an icon is provided', () => {
    hostComponent.icon = faStar;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.empty-orb'))).toBeNull();
  });

  it('should render the icon shell when an icon is provided', () => {
    hostComponent.icon = faStar;
    fixture.detectChanges();

    const shell = fixture.debugElement.query(By.css('.empty-icon-shell'));
    expect(shell).toBeTruthy();
  });

  it('should project content into the actions area', () => {
    fixture.detectChanges();

    const actionsBtn = fixture.debugElement.query(By.css('[empty-state-actions]'));
    expect(actionsBtn).toBeTruthy();
    expect(actionsBtn.nativeElement.textContent).toContain('Action Button');
  });

  it('should render the h2 and p elements', () => {
    hostComponent.title = 'Title';
    hostComponent.description = 'Description';
    fixture.detectChanges();

    const h2 = fixture.debugElement.query(By.css('h2'));
    const p = fixture.debugElement.query(By.css('p'));
    expect(h2).toBeTruthy();
    expect(p).toBeTruthy();
  });
});
