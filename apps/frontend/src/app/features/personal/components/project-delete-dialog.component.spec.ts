import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectDeleteDialogComponent } from './project-delete-dialog.component';
import type { Project } from '@yotara/shared';

describe('ProjectDeleteDialogComponent', () => {
  let fixture: ComponentFixture<ProjectDeleteDialogComponent>;
  let component: ProjectDeleteDialogComponent;

  const mockProject: Project = {
    id: 'proj-1',
    name: 'Website Redesign',
    description: 'Landing page overhaul',
    color: 'teal',
    kind: 'project',
    sortOrder: 0,
    pinned: false,
    ownerId: 'user-1',
    taskCount: 5,
    completedTaskCount: 2,
    openTaskCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectDeleteDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDeleteDialogComponent);
    component = fixture.componentInstance;
  });

  it('renders the project name and task count when open', () => {
    component.open = true;
    component.project = mockProject;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Website Redesign');
    expect(text).toContain('5 tasks');
    expect(text).toContain('Delete project, keep tasks');
    expect(text).toContain('Delete project and tasks');
  });

  it('defaults to keepTasks=true and emits choice on confirm', () => {
    component.open = true;
    component.project = mockProject;
    fixture.detectChanges();

    const confirmSpy = spyOn(component.confirmDelete, 'emit');

    expect(component['keepTasks']()).toBeTrue();

    // Click confirm button
    const confirmBtn = fixture.nativeElement.querySelector('.primary-button');
    confirmBtn.click();

    expect(confirmSpy).toHaveBeenCalledWith({ keepTasks: true });
  });

  it('allows selecting delete tasks option and emits keepTasks=false', () => {
    component.open = true;
    component.project = mockProject;
    fixture.detectChanges();

    const confirmSpy = spyOn(component.confirmDelete, 'emit');

    // Select second option
    const options = fixture.nativeElement.querySelectorAll('.delete-option-card');
    options[1].click();
    fixture.detectChanges();

    expect(component['keepTasks']()).toBeFalse();

    const deleteBtn = fixture.nativeElement.querySelector('.danger-button');
    deleteBtn.click();

    expect(confirmSpy).toHaveBeenCalledWith({ keepTasks: false });
  });

  it('emits close on cancel button click', () => {
    component.open = true;
    component.project = mockProject;
    fixture.detectChanges();

    const closeSpy = spyOn(component.close, 'emit');
    const cancelBtn = fixture.nativeElement.querySelector('.secondary-button');
    cancelBtn.click();

    expect(closeSpy).toHaveBeenCalled();
  });
});
