import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { Label } from '@yotara/shared';
import { LabelService } from '../../../core/services/label.service';
import { TaskService } from '../../../core/services/task.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PersonalTaskCardComponent } from '../components/personal-task-card.component';
import { PersonalTaskWorkspaceComponent } from '../components/personal-task-workspace.component';
import { LabelModalComponent } from '../components/label-modal.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';

import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEdit, faTag, faInbox } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-labels-page',
  standalone: true,
  imports: [
    CommonModule,
    PageHeaderComponent,
    PersonalTaskCardComponent,
    PersonalTaskWorkspaceComponent,
    LabelModalComponent,
    FontAwesomeModule,
    EmptyStateComponent,
  ],
  templateUrl: './labels-page.component.html',
  styleUrl: './labels-page.component.scss',
})
export class LabelsPageComponent {
  protected readonly faEdit = faEdit;
  protected readonly faTag = faTag;
  protected readonly faInbox = faInbox;
  protected readonly labelService = inject(LabelService);
  protected readonly taskService = inject(TaskService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workspace = viewChild(PersonalTaskWorkspaceComponent);
  protected readonly taskPane = viewChild<ElementRef<HTMLElement>>('taskPane');

  protected readonly labels = this.labelService.labels;
  protected readonly labelModalOpen = signal(false);
  protected readonly labelModalMode = signal<'create' | 'edit'>('create');
  protected readonly selectedLabelId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('label'))),
    { initialValue: this.route.snapshot.queryParamMap.get('label') },
  );

  protected readonly selectedLabel = computed(
    () => this.labels().find((label) => label.id === this.selectedLabelId()) ?? null,
  );
  protected readonly filteredTasks = computed(() => {
    const labelId = this.selectedLabelId();
    if (!labelId) return [];
    return this.taskService.tasks().filter((task) => task.labels?.includes(labelId));
  });

  constructor() {
    if (!this.selectedLabelId() && this.labels().length > 0) {
      void this.selectLabel(this.labels()[0]);
    }
  }

  protected async selectLabel(label: Label) {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { label: label.id },
      queryParamsHandling: 'merge',
    });

    // On mobile, scroll to the task pane so the user sees the filtered tasks
    if (window.innerWidth <= 1200) {
      requestAnimationFrame(() => {
        this.taskPane()?.nativeElement.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  protected selectLabelById(labelId: string | null) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { label: labelId || null },
      queryParamsHandling: 'merge',
    });
  }

  protected openCreateLabel() {
    this.labelModalMode.set('create');
    this.labelModalOpen.set(true);
  }

  protected openEditLabel(label: Label, event?: MouseEvent) {
    event?.stopPropagation();
    void this.selectLabel(label);
    this.labelModalMode.set('edit');
    this.labelModalOpen.set(true);
  }

  protected openManageLabels() {
    this.labelModalMode.set(this.selectedLabel() ? 'edit' : 'create');
    this.labelModalOpen.set(true);
  }

  protected closeLabelModal() {
    this.labelModalOpen.set(false);
  }

  protected onLabelSaved() {
    this.labelModalMode.set('edit');
    this.labelModalOpen.set(true);
  }

  protected onLabelDeleted() {
    this.labelModalMode.set('create');
    this.selectLabelById(null);
  }
}
