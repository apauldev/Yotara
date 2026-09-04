import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-modal-autofocus-host',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open" title="Autofocus modal">
      <button type="button" id="first">First</button>
      <input id="second" autofocus placeholder="second" />
    </app-modal>
  `,
})
class AutofocusHostComponent {
  open = false;
}

@Component({
  selector: 'app-modal-trap-host',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open" title="Trap modal">
      <button type="button" id="one">One</button>
      <button type="button" id="two">Two</button>
    </app-modal>
  `,
})
class TrapHostComponent {
  open = false;
}

@Component({
  selector: 'app-modal-footer-host',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="open" title="Footer modal" layout="full-height">
      <p>Body content</p>
      <div modal-footer>Footer actions</div>
    </app-modal>
  `,
})
class FooterHostComponent {
  open = false;
}

@Component({
  selector: 'app-modal-layout-host',
  standalone: true,
  imports: [ModalComponent],
  template: `
    <app-modal [open]="true" title="Layout modal" [layout]="layout">
      <p>Body</p>
    </app-modal>
  `,
})
class LayoutHostComponent {
  layout: 'default' | 'full-height' = 'default';
}

describe('ModalComponent', () => {
  let fixture: ComponentFixture<ModalComponent>;
  let component: ModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ModalComponent,
        AutofocusHostComponent,
        TrapHostComponent,
        FooterHostComponent,
        LayoutHostComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    document.body.style.overflow = '';
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });

  it('does not render content when closed', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('renders the dialog and locks body scroll when open', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Example modal');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('emits close from the backdrop and close button', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    const closeSpy = spyOn(component.close, 'emit');
    fixture.debugElement.query(By.css('.backdrop')).nativeElement.click();
    fixture.debugElement.query(By.css('.close-button')).nativeElement.click();

    expect(closeSpy).toHaveBeenCalledTimes(2);
  });

  it('emits afterOpen once the modal is rendered', () => {
    const afterOpenSpy = spyOn(component.afterOpen, 'emit');

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    expect(afterOpenSpy).toHaveBeenCalledTimes(1);
  });

  it('preserves the default layout for existing consumers', () => {
    const hostFixture = TestBed.createComponent(LayoutHostComponent);
    hostFixture.componentInstance.layout = 'default';
    hostFixture.detectChanges();

    const card = hostFixture.nativeElement.querySelector('.modal-card');
    expect(card).toBeTruthy();
    expect(card.classList.contains('modal-card-full-height')).toBe(false);
    expect(hostFixture.nativeElement.querySelector('.modal-body-scroll')).toBeFalsy();
  });

  it('applies the full-height layout with a body scroll region and footer', () => {
    const hostFixture = TestBed.createComponent(LayoutHostComponent);
    hostFixture.componentInstance.layout = 'full-height';
    hostFixture.detectChanges();

    const card = hostFixture.nativeElement.querySelector('.modal-card');
    expect(card.classList.contains('modal-card-full-height')).toBe(true);
    expect(hostFixture.nativeElement.querySelector('.modal-body-scroll')).toBeTruthy();
    expect(hostFixture.nativeElement.querySelector('.modal-footer')).toBeTruthy();
  });

  it('prefers an element marked autofocus over the first focusable element', () => {
    const hostFixture = TestBed.createComponent(AutofocusHostComponent);
    hostFixture.componentInstance.open = true;
    hostFixture.detectChanges();

    const second = hostFixture.nativeElement.querySelector('#second') as HTMLElement;
    expect(document.activeElement).toBe(second);
  });

  it('wraps Tab from the last focusable element to the first', () => {
    const hostFixture = TestBed.createComponent(TrapHostComponent);
    hostFixture.componentInstance.open = true;
    hostFixture.detectChanges();

    const dialog = hostFixture.nativeElement.querySelector('.modal-card') as HTMLElement;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    last.focus();

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));

    expect(document.activeElement).toBe(first);
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    const hostFixture = TestBed.createComponent(TrapHostComponent);
    hostFixture.componentInstance.open = true;
    hostFixture.detectChanges();

    const dialog = hostFixture.nativeElement.querySelector('.modal-card') as HTMLElement;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first.focus();

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }),
    );

    expect(document.activeElement).toBe(last);
  });

  it('emits close on Escape from the dialog', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    const closeSpy = spyOn(component.close, 'emit');
    const dialog = fixture.nativeElement.querySelector('.modal-card') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not emit close on Escape when closeOnEsc is false', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.componentRef.setInput('closeOnEsc', false);
    fixture.detectChanges();

    const closeSpy = spyOn(component.close, 'emit');
    const dialog = fixture.nativeElement.querySelector('.modal-card') as HTMLElement;
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('restores focus to the trigger on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    try {
      fixture.componentRef.setInput('open', true);
      fixture.componentRef.setInput('title', 'Example modal');
      fixture.detectChanges();

      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();

      expect(document.activeElement).toBe(trigger);
    } finally {
      trigger.remove();
    }
  });

  it('does not move focus when the trigger is detached on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();

    trigger.remove();

    expect(() => {
      fixture.componentRef.setInput('open', false);
      fixture.detectChanges();
    }).not.toThrow();
    expect(document.activeElement).not.toBe(trigger);
  });

  it('preserves and restores the previous body overflow value', () => {
    document.body.style.overflow = 'auto';

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('restores body overflow when destroyed while open', () => {
    document.body.style.overflow = 'scroll';

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.destroy();
    expect(document.body.style.overflow).toBe('scroll');
  });

  it('renders projected footer content', () => {
    const hostFixture = TestBed.createComponent(FooterHostComponent);
    hostFixture.componentInstance.open = true;
    hostFixture.detectChanges();

    const footer = hostFixture.nativeElement.querySelector('.modal-footer') as HTMLElement;
    expect(footer).toBeTruthy();
    expect(footer.textContent).toContain('Footer actions');
  });

  it('renders an empty footer slot when no [modal-footer] is projected', () => {
    const hostFixture = TestBed.createComponent(LayoutHostComponent);
    hostFixture.componentInstance.layout = 'default';
    hostFixture.detectChanges();

    const footer = hostFixture.nativeElement.querySelector('.modal-footer') as HTMLElement;
    expect(footer).toBeTruthy();
    expect(footer.textContent?.trim()).toBe('');
    expect(footer.childElementCount).toBe(0);
  });

  it('resets the body lock correctly across open/close cycles', () => {
    document.body.style.overflow = 'auto';

    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Example modal');
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('auto');

    document.body.style.overflow = 'scroll';

    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('hidden');

    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
