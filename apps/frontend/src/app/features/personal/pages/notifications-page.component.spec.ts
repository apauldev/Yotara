import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { NotificationsPageComponent } from './notifications-page.component';
import { NotificationService } from '../../../core/services/notification.service';
import type { Notification } from '@yotara/shared';

const mockNotifications: Notification[] = [
  {
    id: 'n1',
    taskId: 't1',
    type: 'due_today',
    title: 'Task due today',
    body: 'Write tests',
    read: false,
    readAt: null,
    createdAt: '2026-07-17T10:00:00.000Z',
  },
  {
    id: 'n2',
    taskId: 't2',
    type: 'overdue',
    title: 'Task overdue',
    body: 'Old task',
    read: true,
    readAt: '2026-07-17T11:00:00.000Z',
    createdAt: '2026-07-16T10:00:00.000Z',
  },
];

describe('NotificationsPageComponent', () => {
  let fixture: ComponentFixture<NotificationsPageComponent>;
  let serviceSpy: jasmine.SpyObj<NotificationService>;

  beforeEach(async () => {
    serviceSpy = jasmine.createSpyObj<NotificationService>(
      'NotificationService',
      ['fetchNotifications', 'fetchUnreadCount', 'markAsRead', 'markAllAsRead', 'clearRead'],
      {
        notifications: signal([]),
        unreadCount: signal(0),
        permission: signal('default' as NotificationPermission),
        isSupported: true,
      },
    );

    await TestBed.configureTestingModule({
      imports: [NotificationsPageComponent],
      providers: [provideRouter([]), { provide: NotificationService, useValue: serviceSpy }],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsPageComponent);
  });

  it('shows empty state when no notifications', () => {
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.empty-state'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.notifications-list'))).toBeNull();
  });

  it('renders notifications list when available', () => {
    (serviceSpy as any).notifications.set(mockNotifications);
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.empty-state'))).toBeNull();
    const items = fixture.debugElement.queryAll(By.css('.notification-item'));
    expect(items.length).toBe(2);

    // First is unread
    expect(items[0].nativeElement.classList.contains('notification-unread')).toBeTrue();
    expect(items[0].query(By.css('.mark-read-icon'))).toBeTruthy();

    // Second is read
    expect(items[1].nativeElement.classList.contains('notification-unread')).toBeFalse();
  });

  it('marks notification as read on click', () => {
    (serviceSpy as any).notifications.set([mockNotifications[0]]);
    serviceSpy.markAsRead.and.resolveTo();
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.notification-item')).nativeElement.click();
    expect(serviceSpy.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('does not call markAsRead for already-read notification', () => {
    (serviceSpy as any).notifications.set([mockNotifications[1]]);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('.notification-item')).nativeElement.click();
    expect(serviceSpy.markAsRead).not.toHaveBeenCalled();
  });

  it('clears read notifications on button click', () => {
    (serviceSpy as any).notifications.set(mockNotifications);
    serviceSpy.clearRead.and.resolveTo();
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css('.action-button'))[1].nativeElement.click();
    expect(serviceSpy.clearRead).toHaveBeenCalled();
  });

  it('marks all notifications as read on button click', () => {
    (serviceSpy as any).notifications.set(mockNotifications);
    serviceSpy.markAllAsRead.and.resolveTo();
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css('.action-button'))[0].nativeElement.click();
    expect(serviceSpy.markAllAsRead).toHaveBeenCalled();
  });

  it('disables action buttons when no read notifications exist', () => {
    (serviceSpy as any).notifications.set([mockNotifications[0]]); // only unread
    fixture.detectChanges();

    const buttons = fixture.debugElement.queryAll(By.css('.action-button'));
    expect(buttons[0].nativeElement.disabled).toBeTrue();
    expect(buttons[1].nativeElement.disabled).toBeTrue();
  });

  it('shows unread count and total', () => {
    (serviceSpy as any).notifications.set(mockNotifications);
    (serviceSpy as any).unreadCount.set(1);
    fixture.detectChanges();

    const header = fixture.debugElement.query(By.css('.notifications-count')).nativeElement
      .textContent;
    expect(header).toContain('1 unread');
    expect(header).toContain('2 total');
  });
});
