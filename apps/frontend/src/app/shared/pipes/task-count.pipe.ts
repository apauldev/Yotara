import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'taskCount',
  standalone: true,
})
export class TaskCountPipe implements PipeTransform {
  transform<T>(items: T[] | null | undefined): number {
    return items?.length ?? 0;
  }
}
