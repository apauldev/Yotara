import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faCheckDouble, faEnvelope, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { Notification } from '@yotara/shared';
import { NotificationService } from '../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule, PageHeaderComponent],
  template: `
    <section class="page">
      <app-page-header
        title="Notifications"
        subtitle="Stay on top of your tasks with timely reminders."
      />

      <div class="notifications-card">
        @if (service.notifications().length === 0) {
          <div class="empty-state">
            <fa-icon [icon]="faEnvelope" class="empty-icon"></fa-icon>
            <p class="empty-title">No notifications yet</p>
            <p class="empty-subtitle">When tasks are due or overdue, you'll see them here.</p>
          </div>
        } @else {
          <div class="notifications-header">
            <span class="notifications-count"
              >{{ unreadCount() }} unread &middot; {{ service.notifications().length }} total</span
            >
            <div class="notifications-actions">
              <button
                type="button"
                class="action-button"
                (click)="markAllRead()"
                [disabled]="!hasUnread()"
              >
                <fa-icon [icon]="faCheckDouble"></fa-icon>
                Mark all read
              </button>
              <button
                type="button"
                class="action-button action-button-danger"
                (click)="clearRead()"
                [disabled]="!hasRead()"
              >
                <fa-icon [icon]="faTrash"></fa-icon>
                Clear read
              </button>
            </div>
          </div>

          <div class="notifications-list">
            @for (notif of service.notifications(); track notif.id) {
              <button
                type="button"
                class="notification-item"
                [class.notification-unread]="!notif.read"
                (click)="markRead(notif)"
                [attr.aria-label]="(notif.read ? '' : 'Unread: ') + notif.title + ': ' + notif.body"
              >
                <div class="notification-type-badge" [class]="'badge-' + notif.type">
                  {{ notif.type === 'due_today' ? 'Today' : 'Overdue' }}
                </div>
                <div class="notification-body">
                  <strong>{{ notif.title }}</strong>
                  <span>{{ notif.body }}</span>
                  <span class="notification-time">{{ notif.createdAt | date: 'short' }}</span>
                </div>
                @if (!notif.read) {
                  <fa-icon [icon]="faCheck" class="mark-read-icon" title="Mark as read"></fa-icon>
                }
              </button>
            }
          </div>
        }
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      :host {
        display: block;
      }

      .page {
        padding: 1rem 0 2rem;
      }

      .notifications-card {
        margin-top: 1.5rem;
        border-radius: 1.5rem;
        background: var(--surface-card);
        box-shadow: inset 0 0 0 1px var(--outline-variant);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
        max-width: 42rem;
      }

      .empty-state {
        text-align: center;
        padding: 3rem 1rem;
        color: var(--on-surface-muted);
      }

      .empty-icon {
        font-size: 2.5rem;
        margin-bottom: 1rem;
        opacity: 0.4;
      }

      .empty-title {
        margin: 0 0 0.25rem;
        font-weight: 600;
        font-size: 1.05rem;
        color: var(--on-surface);
      }

      .empty-subtitle {
        margin: 0;
        font-size: 0.85rem;
      }

      .notifications-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 0.25rem;
      }

      .notifications-count {
        font-size: 0.8rem;
        color: var(--on-surface-subtle);
        font-weight: 600;
      }

      .notifications-actions {
        display: flex;
        gap: 0.5rem;
      }

      .action-button {
        appearance: none;
        border: 0;
        background: var(--surface-container-high);
        color: var(--on-surface-muted);
        padding: 0.35rem 0.75rem;
        border-radius: 0.5rem;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.35rem;
        transition: all 120ms ease;
      }

      .action-button:hover:not(:disabled) {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .action-button-danger:hover:not(:disabled) {
        background: var(--error-soft);
        color: var(--error-solid);
      }

      .action-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .notifications-list {
        display: flex;
        flex-direction: column;
        gap: 0.625rem;
      }

      .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.75rem;
        border: 0;
        background: transparent;
        cursor: pointer;
        text-align: left;
        font: inherit;
        transition: background-color 120ms ease;
      }

      .notification-item:hover {
        background: var(--surface-container-high);
      }

      .notification-unread {
        background: var(--primary-soft);
      }

      .notification-type-badge {
        flex: 0 0 auto;
        padding: 0.15rem 0.5rem;
        border-radius: 0.35rem;
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-top: 0.1rem;
      }

      .badge-due_today {
        background: var(--primary-soft);
        color: var(--primary-solid);
      }

      .badge-overdue {
        background: var(--error-soft);
        color: var(--error-solid);
      }

      .notification-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        min-width: 0;
      }

      .notification-body strong {
        font-size: 0.9rem;
        color: var(--on-surface);
      }

      .notification-body span {
        font-size: 0.82rem;
        color: var(--on-surface-muted);
      }

      .notification-time {
        font-size: 0.72rem !important;
        color: var(--on-surface-subtle) !important;
        margin-top: 0.1rem;
      }

      .mark-read-icon {
        flex: 0 0 auto;
        align-self: center;
        color: var(--primary-solid);
        font-size: 0.8rem;
        opacity: 0.6;
      }

      .notification-item:hover .mark-read-icon {
        opacity: 1;
      }

      @media (max-width: 640px) {
        .notifications-card {
          padding: 1rem;
          border-radius: 1.25rem;
        }

        .notifications-header {
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .notifications-actions {
          flex-wrap: wrap;
        }

        .notification-item {
          padding: 0.6rem;
          gap: 0.5rem;
        }
      }
    `,
  ],
})
export class NotificationsPageComponent implements OnInit {
  protected readonly service = inject(NotificationService);
  protected readonly faEnvelope = faEnvelope;
  protected readonly faCheck = faCheck;
  protected readonly faCheckDouble = faCheckDouble;
  protected readonly faTrash = faTrash;

  protected readonly unreadCount = this.service.unreadCount;
  protected readonly hasUnread = computed(() => this.service.notifications().some((n) => !n.read));
  protected readonly hasRead = computed(() => this.service.notifications().some((n) => n.read));

  async ngOnInit() {
    await this.service.fetchNotifications();
    await this.service.fetchUnreadCount();
  }

  async markRead(notif: Notification) {
    if (notif.read) return;
    await this.service.markAsRead(notif.id);
  }

  async markAllRead() {
    await this.service.markAllAsRead();
  }

  async clearRead() {
    await this.service.clearRead();
  }
}
