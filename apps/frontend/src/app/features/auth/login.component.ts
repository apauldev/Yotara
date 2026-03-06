import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@yotara/shared';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [FormsModule],
    template: `
    <div class="auth-container">
      <div class="auth-card">
        <h2>{{ isLogin() ? 'Sign In' : 'Sign Up' }}</h2>
        
        <form (ngSubmit)="onSubmit()">
          @if (!isLogin()) {
            <div class="form-group">
              <label>Name</label>
              <input type="text" [(ngModel)]="name" name="name" required />
            </div>
          }
          
          <div class="form-group">
            <label>Email</label>
            <input type="email" [(ngModel)]="email" name="email" required />
          </div>
          
          <div class="form-group">
            <label>Password</label>
            <input type="password" [(ngModel)]="password" name="password" required />
          </div>
          
          @if (error()) {
            <div class="error-msg">{{ error() }}</div>
          }
          
          <button type="submit" [disabled]="loading()">
            {{ loading() ? 'Loading...' : (isLogin() ? 'Sign In' : 'Sign Up') }}
          </button>
        </form>
        
        <p class="toggle-mode" (click)="toggleMode()">
          {{ isLogin() ? 'Need an account? Sign up' : 'Already have an account? Sign in' }}
        </p>
      </div>
    </div>
  `,
    styles: [`
    .auth-container { display: flex; justify-content: center; align-items: center; min-height: 80vh; }
    .auth-card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    h2 { text-align: center; margin-bottom: 1.5rem; color: #333; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555; }
    input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 0.75rem; background: #007bff; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; margin-top: 1rem; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .toggle-mode { text-align: center; margin-top: 1rem; color: #007bff; cursor: pointer; font-size: 0.875em; border-top: 1px solid transparent; padding-top: 5px;}
    .toggle-mode:hover { text-decoration: underline; }
    .error-msg { color: #dc3545; font-size: 0.875rem; margin-top: 0.5rem; text-align: center; }
  `]
})
export class LoginComponent {
    isLogin = signal(true);
    email = signal('');
    password = signal('');
    name = signal('');
    loading = signal(false);
    error = signal('');

    constructor(private router: Router) { }

    toggleMode() {
        this.isLogin.set(!this.isLogin());
        this.error.set('');
    }

    async onSubmit() {
        this.loading.set(true);
        this.error.set('');

        try {
            let res;
            if (this.isLogin()) {
                res = await AuthService.signIn(this.email(), this.password());
            } else {
                res = await AuthService.signUp(this.email(), this.password(), this.name());
            }

            if (res.error) {
                this.error.set(res.error.message || 'Authentication failed');
            } else {
                this.router.navigate(['/']);
            }
        } catch (err: any) {
            this.error.set(err.message || 'An unexpected error occurred');
        } finally {
            this.loading.set(false);
        }
    }
}
