import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LegalContentService, type LegalDocument } from './legal-content.service';

const validDocument: LegalDocument = {
  type: 'terms-of-service',
  version: '1.0',
  effectiveDate: '2026-09-02',
  title: 'Yotara Beta Terms of Service',
  content: '# Terms\n\nUse the beta responsibly.',
};

describe('LegalContentService', () => {
  let service: LegalContentService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });

    service = TestBed.inject(LegalContentService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('loads and exposes a valid terms document', async () => {
    const loadPromise = service.load();
    const request = httpMock.expectOne('/legal/terms.json');

    expect(request.request.headers.get('Accept')).toBe('application/json');
    expect(request.request.headers.get('X-Skip-Loading')).toBe('true');
    expect(request.request.headers.get('X-Skip-Error')).toBe('true');

    request.flush(validDocument);
    await loadPromise;

    expect(service.loaded()).toBeTrue();
    expect(service.configured()).toBeTrue();
    expect(service.document()).toEqual(validDocument);
  });

  it('treats a missing terms file as disabled configuration', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/legal/terms.json').flush({}, { status: 404, statusText: 'Not Found' });
    await loadPromise;

    expect(service.loaded()).toBeTrue();
    expect(service.configured()).toBeFalse();
    expect(service.document()).toBeNull();
  });

  it('rejects an invalid document shape', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/legal/terms.json').flush({ ...validDocument, content: '' });
    await loadPromise;

    expect(service.configured()).toBeFalse();
    expect(service.document()).toBeNull();
  });

  it('rejects HTML returned by an SPA fallback', async () => {
    const loadPromise = service.load();
    httpMock.expectOne('/legal/terms.json').flush('<!doctype html><html></html>');
    await loadPromise;

    expect(service.configured()).toBeFalse();
    expect(service.document()).toBeNull();
  });

  it('coalesces concurrent loads', async () => {
    const firstLoad = service.load();
    const secondLoad = service.load();

    const requests = httpMock.match('/legal/terms.json');
    expect(requests).toHaveSize(1);
    requests[0].flush(validDocument);
    await Promise.all([firstLoad, secondLoad]);

    expect(service.configured()).toBeTrue();
  });
});
