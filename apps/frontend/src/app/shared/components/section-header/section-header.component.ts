import { CommonModule } from '@angular/common';
import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

type SectionHeaderSize = 'sm' | 'md' | 'lg';
type SectionHeaderTone = 'default' | 'accent';

@Component({
  selector: 'app-section-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-header.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './section-header.component.css',
})
export class SectionHeaderComponent {
  @Input() title = '';
  @Input() count: string | number | null = null;
  @Input() size: SectionHeaderSize = 'md';
  @Input() tone: SectionHeaderTone = 'default';
}
