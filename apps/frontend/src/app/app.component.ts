import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageHeaderComponent } from './shared/components/page-header/page-header.component';
import { HlmButton } from '@yotara/ui/button';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PageHeaderComponent, HlmButton],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent { }
