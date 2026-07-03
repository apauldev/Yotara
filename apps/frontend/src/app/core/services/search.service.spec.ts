import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SearchService } from './search.service';
import { firstValueFrom } from 'rxjs';
import type { SearchResponse } from '@yotara/shared';

describe('SearchService', () => {
  let service: SearchService;
  let httpMock: HttpTestingController;

  const mockSearchResponse: SearchResponse = {
    query: 'polish',
    normalizedQuery: 'polish',
    tasks: [
      {
        task: {
          id: 'task-1',
          title: 'Polish search results',
          description: 'Tune the global search page copy and ranking.',
          status: 'today' as const,
          priority: 'high' as const,
          completed: false,
          dueDate: '2026-04-24',
          order: 0,
          createdAt: '2026-04-20T10:00:00.000Z',
          updatedAt: '2026-04-23T10:00:00.000Z',
        },
        project: null,
        score: 120,
        matchReasons: ['title'],
      },
    ],
    projects: [],
    labels: [],
  };

  const emptySearchResponse: SearchResponse = {
    query: '',
    normalizedQuery: '',
    tasks: [],
    projects: [],
    labels: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [SearchService],
    }).compileComponents();

    service = TestBed.inject(SearchService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('search', () => {
    it('makes a GET request to /tasks/search with the query', async () => {
      const result$ = service.search('polish');
      const resultPromise = firstValueFrom(result$);

      const req = httpMock.expectOne(
        (request) =>
          request.url.endsWith('/tasks/search') &&
          request.params.get('q') === 'polish' &&
          request.method === 'GET',
      );
      expect(req.request.withCredentials).toBeTrue();
      req.flush(mockSearchResponse);

      const result = await resultPromise;
      expect(result.tasks.length).toBe(1);
      expect(result.tasks[0].task.title).toBe('Polish search results');
    });

    it('returns empty results for an empty query without making an HTTP call', async () => {
      const result = await firstValueFrom(service.search(''));
      expect(result.tasks).toEqual([]);
      expect(result.projects).toEqual([]);
      expect(result.labels).toEqual([]);
      expect(result.query).toBe('');
      httpMock.expectNone('/tasks/search');
    });

    it('returns empty results for whitespace-only query', async () => {
      const result = await firstValueFrom(service.search('   '));
      expect(result.tasks).toEqual([]);
      expect(result.projects).toEqual([]);
      expect(result.labels).toEqual([]);
      httpMock.expectNone('/tasks/search');
    });

    it('passes through the search response from the API', async () => {
      const result$ = service.search('polish');
      const resultPromise = firstValueFrom(result$);

      const req = httpMock.expectOne((r) => r.url.endsWith('/tasks/search'));
      req.flush(mockSearchResponse);

      const result = await resultPromise;
      expect(result.query).toBe('polish');
      expect(result.normalizedQuery).toBe('polish');
    });
  });

  describe('searchArchive', () => {
    it('makes a GET request with completed=true and large pageSize', async () => {
      const result$ = service.searchArchive('finished');
      const resultPromise = firstValueFrom(result$);

      const req = httpMock.expectOne(
        (request) =>
          request.url.endsWith('/tasks/search') &&
          request.params.get('q') === 'finished' &&
          request.params.get('completed') === 'true' &&
          request.params.get('pageSize') === '100',
      );
      req.flush(mockSearchResponse);

      const result = await resultPromise;
      expect(result.tasks.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('returns empty for empty query without HTTP call', async () => {
      const result = await firstValueFrom(service.searchArchive(''));
      expect(result.tasks).toEqual([]);
      expect(result.total).toBe(0);
      httpMock.expectNone('/tasks/search');
    });

    it('returns empty tasks and total 0 when API returns no matches', async () => {
      const emptyResponse: SearchResponse = {
        query: 'zzzznonexistent',
        normalizedQuery: 'zzzznonexistent',
        tasks: [],
        projects: [],
        labels: [],
      };

      const result$ = service.searchArchive('zzzznonexistent');
      const resultPromise = firstValueFrom(result$);

      const req = httpMock.expectOne((r) => r.url.endsWith('/tasks/search'));
      req.flush(emptyResponse);

      const result = await resultPromise;
      expect(result.tasks).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('sends withCredentials on the archive request', async () => {
      const result$ = service.searchArchive('finished');
      const resultPromise = firstValueFrom(result$);

      const req = httpMock.expectOne((r) => r.url.endsWith('/tasks/search'));
      expect(req.request.withCredentials).toBeTrue();
      req.flush(mockSearchResponse);

      await resultPromise;
    });
  });

  describe('searchAllTasks', () => {
    it('fetches all task pages until a partial page is returned', async () => {
      const page1: SearchResponse = {
        ...emptySearchResponse,
        query: 'find',
        normalizedQuery: 'find',
        tasks: Array.from({ length: 100 }, (_, i) => ({
          task: {
            id: `task-${i}`,
            title: `Task ${i}`,
            status: 'today' as const,
            priority: 'medium' as const,
            completed: false,
            order: i,
            createdAt: '2026-04-20T10:00:00.000Z',
            updatedAt: '2026-04-23T10:00:00.000Z',
          },
          project: null,
          score: 10,
          matchReasons: ['title'],
        })),
      };
      const page2: SearchResponse = {
        ...emptySearchResponse,
        query: 'find',
        normalizedQuery: 'find',
        tasks: [
          {
            task: {
              id: 'task-100',
              title: 'Task 100',
              status: 'today' as const,
              priority: 'medium' as const,
              completed: false,
              order: 100,
              createdAt: '2026-04-20T10:00:00.000Z',
              updatedAt: '2026-04-23T10:00:00.000Z',
            },
            project: null,
            score: 10,
            matchReasons: ['title'],
          },
        ],
      };

      const result$ = service.searchAllTasks('find');
      const resultPromise = firstValueFrom(result$);

      const req1 = httpMock.expectOne((r) => r.params.get('page') === '1');
      req1.flush(page1);

      const req2 = httpMock.expectOne((r) => r.params.get('page') === '2');
      req2.flush(page2);

      const result = await resultPromise;
      expect(result.length).toBe(101);
      expect(result[100].task.id).toBe('task-100');
    });

    it('returns empty for empty query without HTTP call', async () => {
      const result = await firstValueFrom(service.searchAllTasks(''));
      expect(result).toEqual([]);
      httpMock.expectNone('/tasks/search');
    });

    it('sends withCredentials on all-tasks requests', async () => {
      const result$ = service.searchAllTasks('find');
      const resultPromise = firstValueFrom(result$);

      const req = httpMock.expectOne((r) => r.url.endsWith('/tasks/search'));
      expect(req.request.withCredentials).toBeTrue();
      req.flush(emptySearchResponse);

      await resultPromise;
    });
  });
});
