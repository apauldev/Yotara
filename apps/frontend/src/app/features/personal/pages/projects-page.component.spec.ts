import { TestBed } from '@angular/core/testing';
import { ProjectsPageComponent } from './projects-page.component';

describe('ProjectsPageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsPageComponent],
    }).compileComponents();
  });

  it('renders the placeholder project cards', () => {
    const fixture = TestBed.createComponent(ProjectsPageComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Work');
    expect(text).toContain('Home');
    expect(text).toContain('Health');
    expect(text).toContain('Create New Project');
  });
});
