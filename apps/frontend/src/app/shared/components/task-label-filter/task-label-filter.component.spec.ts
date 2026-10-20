import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import type { Label } from '@yotara/shared';
import { TaskLabelFilterComponent } from './task-label-filter.component';

const labels: Label[] = [
  {
    id: 'l1',
    name: 'Errand',
    color: '#f1c582',
    icon: 'basket-shopping',
    pinned: false,
    userId: 'u1',
  },
  { id: 'l2', name: 'Writing', color: '#82d7a9', icon: 'pen', pinned: false, userId: 'u1' },
];

describe('TaskLabelFilterComponent', () => {
  let fixture: ComponentFixture<TaskLabelFilterComponent>;
  let component: TaskLabelFilterComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskLabelFilterComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TaskLabelFilterComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('labels', labels);
    fixture.detectChanges();
  });

  it('opens a searchable multi-select panel', () => {
    fixture.debugElement.query(By.css('.filter-trigger')).nativeElement.click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.filter-panel'))).toBeTruthy();
    expect(fixture.debugElement.queryAll(By.css('.filter-option')).length).toBe(2);

    const search = fixture.debugElement.query(By.css('.filter-search')).nativeElement;
    search.value = 'wri';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const names = fixture.debugElement
      .queryAll(By.css('.filter-option-name'))
      .map((name) => name.nativeElement.textContent.trim());
    expect(names).toEqual(['Writing']);
  });

  it('moves focus into the search field and returns it on Escape', fakeAsync(() => {
    const trigger: HTMLButtonElement = fixture.debugElement.query(
      By.css('.filter-trigger'),
    ).nativeElement;
    trigger.click();
    fixture.detectChanges();
    tick();

    const search: HTMLInputElement = fixture.debugElement.query(
      By.css('.filter-search'),
    ).nativeElement;
    expect(document.activeElement).toBe(search);

    search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(document.activeElement).toBe(trigger);
    expect(fixture.debugElement.query(By.css('.filter-panel'))).toBeNull();
  }));

  it('emits the full selected id list when an option is toggled', () => {
    const emitted: string[][] = [];
    component.selectionChange.subscribe((ids) => emitted.push(ids));

    fixture.debugElement.query(By.css('.filter-trigger')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css('.filter-option'))[1].nativeElement.click();
    expect(emitted).toEqual([['l2']]);
  });

  it('shows the Any/All mode only with multiple selections', () => {
    fixture.componentRef.setInput('selectedIds', ['l1']);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('.filter-trigger')).nativeElement.click();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.filter-mode'))).toBeNull();

    fixture.componentRef.setInput('selectedIds', ['l1', 'l2']);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.filter-mode'))).toBeTruthy();

    const mode = fixture.debugElement.queryAll(By.css('.mode-pill'))[1];
    expect(mode.nativeElement.textContent.trim()).toBe('All');
  });

  it('clears the filter and closes on Done', () => {
    fixture.componentRef.setInput('selectedIds', ['l1']);
    fixture.detectChanges();
    const emitted: string[][] = [];
    component.selectionChange.subscribe((ids) => emitted.push(ids));

    fixture.debugElement.query(By.css('.filter-trigger')).nativeElement.click();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.filter-action')).nativeElement.click();
    expect(emitted).toEqual([[]]);

    fixture.debugElement.queryAll(By.css('.filter-action'))[1].nativeElement.click();
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.filter-panel'))).toBeNull();
  });
});
