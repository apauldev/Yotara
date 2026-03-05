import { Component, Input } from '@angular/core';
import { Task } from '@yotara/shared';

@Component({
  selector: 'app-task-list',
  standalone: true,
  templateUrl: './task-list.component.html',
  styleUrl: './task-list.component.css',
})
export class TaskListComponent {
  @Input({ required: true }) heading = '';
  @Input({ required: true }) tasks: Task[] = [];
  @Input() showStatus = false;
}
