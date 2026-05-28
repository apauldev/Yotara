import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarkdownComponent } from 'ngx-markdown';
import { FormatToolbarComponent, SyntaxInsert } from './format-toolbar.component';

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  imports: [FormsModule, MarkdownComponent, FormatToolbarComponent],
  templateUrl: './markdown-editor.component.html',
  styleUrl: './markdown-editor.component.css',
})
export class MarkdownEditorComponent {
  @Input() value = '';
  @Input() placeholder = '';
  @Input() rows = 7;
  @Output() readonly valueChange = new EventEmitter<string>();

  @ViewChild('textareaRef') textareaRef?: ElementRef<HTMLTextAreaElement>;

  protected readonly previewMode = signal(false);

  protected onValueChange(newValue: string) {
    this.value = newValue;
    this.valueChange.emit(newValue);
  }

  protected togglePreview() {
    this.previewMode.update((v) => !v);
  }

  protected onInsertSyntax(event: SyntaxInsert) {
    const textarea = this.textareaRef?.nativeElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = textarea.value;
    const selectedText = currentValue.substring(start, end);

    let newValue: string;
    let cursorPos: number;

    if (selectedText) {
      newValue =
        currentValue.substring(0, start) +
        event.prefix +
        selectedText +
        event.suffix +
        currentValue.substring(end);
      cursorPos = start + event.prefix.length + selectedText.length + event.suffix.length;
    } else {
      newValue =
        currentValue.substring(0, start) +
        event.prefix +
        event.suffix +
        currentValue.substring(end);
      cursorPos = start + event.prefix.length;
    }

    this.value = newValue;
    this.valueChange.emit(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursorPos, cursorPos);
    });
  }
}
