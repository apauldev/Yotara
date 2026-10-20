import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { faTag } from '@fortawesome/free-solid-svg-icons';
import { pickOnColor } from '../../utils/color-contrast';
import { LabelIconComponent } from './label-icon.component';

describe('LabelIconComponent', () => {
  let fixture: ComponentFixture<LabelIconComponent>;

  function create(inputs: Partial<LabelIconComponent> = {}) {
    fixture = TestBed.createComponent(LabelIconComponent);
    Object.assign(fixture.componentInstance, { icon: 'tag', color: '#d44d3c', ...inputs });
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LabelIconComponent] }).compileComponents();
  });

  it('renders the mapped glyph and falls back to the tag for unknown keys', () => {
    const tagged = create({ icon: 'flame' });
    expect(tagged.debugElement.query(By.css('fa-icon'))).toBeTruthy();

    const fallback = create({ icon: 'not-a-real-icon' });
    expect(fallback.componentInstance['definition']).toBe(faTag);
  });

  it('uses the label color and a contrast-safe glyph color', () => {
    const fixtureComponent = create({ icon: 'pen', color: '#d44d3c' });
    const host = fixtureComponent.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--label-color')).toBe('#d44d3c');
    expect(host.style.getPropertyValue('--label-on-strong')).toBe(pickOnColor('#d44d3c') ?? '');
  });

  it('falls back to accent tokens for legacy colors', () => {
    const legacy = create({ color: 'rebeccapurple' });
    const host = legacy.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--label-color')).toBe('var(--accent-strong)');
  });

  it('drops the tile in flat mode', () => {
    const flat = create({ flat: true });
    expect(flat.debugElement.query(By.css('.label-icon-flat'))).toBeTruthy();
  });
});
