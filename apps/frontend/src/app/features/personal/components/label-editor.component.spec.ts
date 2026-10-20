import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { pickLabelColorForName, type Label } from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { LogService } from '../../../core/services/log.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { LabelEditorComponent } from './label-editor.component';

const existingLabel: Label = {
  id: 'label-1',
  name: 'Writing',
  color: '#82d7a9',
  icon: 'pen',
  pinned: false,
  userId: 'user-1',
  openTaskCount: 3,
  completedTaskCount: 2,
  totalTaskCount: 5,
};

describe('LabelEditorComponent', () => {
  let fixture: ComponentFixture<LabelEditorComponent>;
  let component: LabelEditorComponent;
  let createLabelSpy: jasmine.Spy;
  let updateLabelSpy: jasmine.Spy;

  beforeEach(async () => {
    createLabelSpy = jasmine.createSpy('createLabel');
    updateLabelSpy = jasmine.createSpy('updateLabel');

    await TestBed.configureTestingModule({
      imports: [LabelEditorComponent],
      providers: [
        {
          provide: LabelService,
          useValue: { createLabel: createLabelSpy, updateLabel: updateLabelSpy },
        },
        { provide: LogService, useValue: { warn: () => {} } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LabelEditorComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  function openWith(label: Label | null) {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('label', label);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  }

  it('opens in the drawer layout with a live chip preview', () => {
    const modal = fixture.debugElement.query(By.directive(ModalComponent));
    expect(modal.componentInstance.layout).toBe('drawer');

    component['onNameChange']('Writing');
    fixture.detectChanges();

    const preview = fixture.debugElement.query(By.css('.preview app-label-chip'));
    expect(preview.componentInstance.label.name).toBe('Writing');
    expect(preview.componentInstance.label.icon).toBe('pen');
    expect(preview.componentInstance.label.color).toBe(pickLabelColorForName('Writing'));
  });

  it('keeps a manually chosen icon while the name changes', () => {
    component['onNameChange']('Writing');
    component['chooseIcon']('flame');
    component['onNameChange']('Writing notes');
    fixture.detectChanges();

    expect(component['draftIcon']()).toBe('flame');
  });

  it('creates a label with the suggested icon and chosen color', async () => {
    const color = pickLabelColorForName('Writing');
    createLabelSpy.and.resolveTo({ ...existingLabel, id: 'new-label', color });
    component['onNameChange']('Writing');

    await component['save']();

    expect(createLabelSpy).toHaveBeenCalledWith({
      name: 'Writing',
      color,
      icon: 'pen',
    });
  });

  it('shows the existing label after a duplicate-name 409', async () => {
    createLabelSpy.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { existingLabel: { id: 'existing-label', name: 'Writing' } },
      }),
    );
    component['onNameChange']('writing');

    await component['save']();
    fixture.detectChanges();

    expect(component['existingLabel']()).toEqual({ id: 'existing-label', name: 'Writing' });
    expect(fixture.nativeElement.textContent).toContain('Open “Writing”');
  });

  it('offers to merge the edited label when the new name exists', async () => {
    openWith(existingLabel);
    updateLabelSpy.and.rejectWith(
      new HttpErrorResponse({
        status: 409,
        error: { existingLabel: { id: 'finance', name: 'Finance' } },
      }),
    );
    const mergeSpy = jasmine.createSpy('mergeRequest');
    component.mergeRequest.subscribe(mergeSpy);

    component['onNameChange']('Finance');
    await component['save']();
    fixture.detectChanges();

    const mergeLink = fixture.debugElement.query(By.css('.merge-link'));
    expect(mergeLink.nativeElement.textContent).toContain('Merge into “Finance”');
    mergeLink.nativeElement.click();

    expect(mergeSpy).toHaveBeenCalledWith({
      source: existingLabel,
      target: { id: 'finance', name: 'Finance' },
    });
  });

  it('keeps a legacy color visible and sanitizes an unknown icon on edit', () => {
    openWith({ ...existingLabel, color: 'rebeccapurple', icon: 'not-real' as never });

    expect(component['customSwatch']()).toBe('rebeccapurple');
    expect(component['draftIcon']()).toBe('tag');
  });

  it('emits the delete request with the edited label and counts', () => {
    openWith(existingLabel);
    const deleteSpy = jasmine.createSpy('deleteRequest');
    component.deleteRequest.subscribe(deleteSpy);

    const danger = fixture.debugElement.query(By.css('.danger-button'));
    expect(fixture.nativeElement.textContent).toContain('3 open and');
    danger.nativeElement.click();

    expect(deleteSpy).toHaveBeenCalledWith(existingLabel);
  });
});
