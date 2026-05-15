import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { loadingInterceptor } from './loading.interceptor';
import { errorInterceptor } from './error.interceptor';
import { StatusService } from '../services/status.service';
import { LogService } from '../services/log.service';

describe('Interceptors', () => {
  let httpMock: HttpTestingController;
  let httpClient: HttpClient;
  let statusService: StatusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        StatusService,
        LogService,
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    httpClient = TestBed.inject(HttpClient);
    statusService = TestBed.inject(StatusService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('LoadingInterceptor', () => {
    it('should increment loading count on request and decrement on completion', (done) => {
      expect(statusService.isLoading()).toBeFalse();

      httpClient.get('/test').subscribe(() => {
        // We check in a timeout because of the finalize delay in the interceptor
        setTimeout(() => {
          expect(statusService.isLoading()).toBeFalse();
          done();
        }, 300);
      });

      const req = httpMock.expectOne('/test');
      expect(statusService.isLoading()).toBeTrue();
      req.flush({});
    });

    it('should skip loading if X-Skip-Loading header is present', () => {
      httpClient.get('/test', { headers: { 'X-Skip-Loading': 'true' } }).subscribe();

      httpMock.expectOne('/test');
      expect(statusService.isLoading()).toBeFalse();
    });
  });

  describe('ErrorInterceptor', () => {
    it('should catch HTTP errors and show an error toast', () => {
      spyOn(statusService, 'error');

      httpClient.get('/error').subscribe({
        error: (err) => {
          expect(err).toBeTruthy();
        },
      });

      const req = httpMock.expectOne('/error');
      req.flush({ message: 'Server Error' }, { status: 500, statusText: 'Internal Server Error' });

      expect(statusService.error).toHaveBeenCalledWith('Server Error');
    });

    it('should provide default messages for common status codes', () => {
      spyOn(statusService, 'error');

      httpClient.get('/404').subscribe({ error: () => {} });
      httpMock.expectOne('/404').flush({}, { status: 404, statusText: 'Not Found' });
      expect(statusService.error).toHaveBeenCalledWith('The requested resource was not found.');

      httpClient.get('/0').subscribe({ error: () => {} });
      httpMock.expectOne('/0').error(new ProgressEvent('error'));
      expect(statusService.error).toHaveBeenCalledWith(
        'Cannot connect to the server. Please check your internet connection.',
      );
    });

    it('should skip 401 errors', () => {
      spyOn(statusService, 'error');

      httpClient.get('/401').subscribe({ error: () => {} });
      httpMock.expectOne('/401').flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(statusService.error).not.toHaveBeenCalled();
    });
  });
});
