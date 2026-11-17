import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideMarkdown } from 'ngx-markdown';
import { PersonalProjectModalComponent } from './personal-project-modal.component';

describe('PersonalProjectModalComponent', () => {
  let fixture: ComponentFixture<PersonalProjectModalComponent>;
  let component: PersonalProjectModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalProjectModalComponent],
      providers: [provideMarkdown()],
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
    expect(fixture.nativeElement.textContent).toContain('Ongoing area');
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
      kind: 'project',
      targetDate: null,
      pinned: false,
    });
    expect(component['nameError']()).toBeNull();
  });

  it('emits the pinned choice when pinning from the form', () => {
    component.open = true;
    fixture.detectChanges();

    const saveSpy = spyOn(component.save, 'emit');
    component['draftName'].set('Pinned project');
    component['draftPinned'].set(true);
    component['submit']();

    expect(saveSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'Pinned project', pinned: true }),
    );
  });

  it('prevents saving an ongoing area with a target date', () => {
    component.open = true;
    fixture.detectChanges();

    const saveSpy = spyOn(component.save, 'emit');

    component['draftName'].set('Health');
    component['draftTargetDate'].set('2026-12-31');
    component['setKind']('ongoing');
    fixture.detectChanges();

    expect(component['targetDateError']()).toContain('Ongoing areas cannot have a target date');

    component['submit']();
    expect(saveSpy).not.toHaveBeenCalled();

    component['clearTargetDate']();
    component['submit']();
    expect(saveSpy).toHaveBeenCalledWith({
      name: 'Health',
      description: null,
      color: 'sage',
      kind: 'ongoing',
      targetDate: null,
      pinned: false,
    });
  });

  it('emits null description so an existing description can be cleared on edit', () => {
    component.mode = 'edit';
    component.project = {
      id: 'p1',
      name: 'Existing',
      description: 'Old text',
      color: 'sage',
      kind: 'project',
      targetDate: null,
      completedAt: null,
      archivedAt: null,
      sortOrder: 0,
      pinned: false,
      ownerId: 'user-1',
      taskCount: 0,
      completedTaskCount: 0,
      openTaskCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    component.open = true;
    fixture.detectChanges();

    const saveSpy = spyOn(component.save, 'emit');
    component['draftName'].set('Existing');
    component['draftDescription'].set('   ');
    component['submit']();

    expect(saveSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'Existing', description: null }),
    );
  });
});
