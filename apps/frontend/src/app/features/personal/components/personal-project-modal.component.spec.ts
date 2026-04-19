import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PersonalProjectModalComponent } from './personal-project-modal.component';

describe('PersonalProjectModalComponent', () => {
  let fixture: ComponentFixture<PersonalProjectModalComponent>;
  let component: PersonalProjectModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalProjectModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalProjectModalComponent);
    component = fixture.componentInstance;
  });

  it('does not render when closed', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('renders the modal content when open', () => {
    component.open = true;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('New Project');
    expect(fixture.nativeElement.textContent).toContain('A project is a home for related tasks');
    expect(fixture.nativeElement.textContent).toContain('Project name');
  });

  it('emits close from the backdrop and close button', () => {
    component.open = true;
    fixture.detectChanges();
    const closeSpy = spyOn(component.close, 'emit');

    fixture.debugElement.query(By.css('.backdrop')).nativeElement.click();
    fixture.debugElement.query(By.css('.close-button')).nativeElement.click();

    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('shows a validation error when the project name is empty', () => {
    component.open = true;
    fixture.detectChanges();

    const saveSpy = spyOn(component.save, 'emit');

    component['draftName'].set('   ');
    component['submit']();
    fixture.detectChanges();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(component['nameError']()).toBe('Project name is required');
    expect(fixture.nativeElement.textContent).toContain('Project name is required');
  });

  it('emits a trimmed payload when the form is valid', () => {
    component.open = true;
    fixture.detectChanges();

    const saveSpy = spyOn(component.save, 'emit');

    component['draftName'].set('  Quarterly reset  ');
    component['draftDescription'].set('  Create a lighter workflow  ');
    component['draftColor'].set('forest');
    component['submit']();

    expect(saveSpy).toHaveBeenCalledWith({
      name: 'Quarterly reset',
      description: 'Create a lighter workflow',
      color: 'forest',
    });
    expect(component['nameError']()).toBeNull();
  });
});
