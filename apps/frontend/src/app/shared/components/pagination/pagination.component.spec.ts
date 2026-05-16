import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let component: PaginationComponent;
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate total pages correctly', () => {
    component.totalItems = 25;
    component.pageSize = 10;
    expect(component.totalPages).toBe(3);
  });

  it('should calculate start and end items correctly', () => {
    component.totalItems = 25;
    component.pageSize = 10;
    component.currentPage = 1;
    expect(component.startItem).toBe(1);
    expect(component.endItem).toBe(10);

    component.currentPage = 3;
    expect(component.startItem).toBe(21);
    expect(component.endItem).toBe(25);
  });

  it('should emit pageChange when onPageChange is called with a number', () => {
    component.totalItems = 50;
    component.pageSize = 10;
    component.currentPage = 1;
    const spy = spyOn(component.pageChange, 'emit');

    component.onPageChange(2);
    expect(spy).toHaveBeenCalledWith(2);
  });

  it('should not emit pageChange when onPageChange is called with dots', () => {
    component.totalItems = 100;
    component.pageSize = 10;
    component.currentPage = 5;
    const spy = spyOn(component.pageChange, 'emit');

    component.onPageChange('...');
    expect(spy).not.toHaveBeenCalled();
  });

  it('should not emit pageChange if page is same as current', () => {
    component.totalItems = 50;
    component.pageSize = 10;
    component.currentPage = 2;
    const spy = spyOn(component.pageChange, 'emit');

    component.onPageChange(2);
    expect(spy).not.toHaveBeenCalled();
  });

  it('should truncate pages correctly for many pages', () => {
    component.totalItems = 100;
    component.pageSize = 10;
    component.currentPage = 5;

    // Expect something like [1, '...', 4, 5, 6, '...', 10]
    const pages = component.pages;
    expect(pages).toContain('...');
    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBe(10);
    expect(pages).toContain(4);
    expect(pages).toContain(5);
    expect(pages).toContain(6);
  });
});
