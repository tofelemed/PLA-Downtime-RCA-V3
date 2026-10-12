import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Public } from '../decorators/public.decorator';
import {
  findUnprotectedRoutes,
  inventoryRoutes,
  routeKey,
} from './route-guard-inventory';

@Controller('guarded')
@UseGuards(JwtAuthGuard)
class GuardedController {
  @Get()
  list(): void {}

  @Post(':id')
  create(): void {}

  helper(): void {}
}

@Controller('mixed')
class MixedController {
  @Get('open')
  open(): void {}

  @UseGuards(JwtAuthGuard)
  @Get('closed')
  closed(): void {}

  @Public()
  @Get('pub')
  pub(): void {}
}

@Controller({ path: 'things', version: '2' })
@UseGuards(JwtAuthGuard)
class ThingsV2Controller {
  @Get()
  list(): void {}
}

describe('route guard inventory', () => {
  const entries = inventoryRoutes([
    GuardedController,
    MixedController,
    ThingsV2Controller,
  ]);

  it('lists only decorated route handlers with method, path and version', () => {
    expect(
      entries.map(
        (entry) => `${entry.method} ${entry.version ?? '-'} ${entry.path}`,
      ),
    ).toEqual([
      'GET - /guarded',
      'POST - /guarded/:id',
      'GET - /mixed/open',
      'GET - /mixed/closed',
      'GET - /mixed/pub',
      'GET 2 /things',
    ]);
  });

  it('treats class-level and method-level guards alike', () => {
    const byKey = new Map(entries.map((entry) => [routeKey(entry), entry]));
    expect(byKey.get('GuardedController.create')?.guarded).toBe(true);
    expect(byKey.get('MixedController.closed')?.guarded).toBe(true);
    expect(byKey.get('MixedController.open')?.guarded).toBe(false);
    expect(byKey.get('MixedController.pub')?.isPublic).toBe(true);
  });

  it('flags unguarded routes unless they are @Public() and allowlisted', () => {
    const allowlisted = findUnprotectedRoutes(
      entries,
      new Set(['MixedController.pub']),
    );
    expect(allowlisted.map(routeKey)).toEqual(['MixedController.open']);

    const strict = findUnprotectedRoutes(entries, new Set());
    expect(strict.map(routeKey)).toEqual([
      'MixedController.open',
      'MixedController.pub',
    ]);
  });
});

abstract class BaseLibraryController {
  @Get()
  list(): void {}

  @Get(':id')
  get(): void {}

  @Post(':id/retire')
  retire(): void {}
}

@Controller({ path: 'library', version: '2' })
@UseGuards(JwtAuthGuard)
class LibraryController extends BaseLibraryController {
  @Get(':id')
  override get(): void {}

  @Get('extra')
  extra(): void {}
}

describe('route guard inventory of inherited routes', () => {
  const entries = inventoryRoutes([LibraryController]);

  it('lists routes declared on a base controller once per subclass', () => {
    expect(
      entries.map(
        (entry) => `${entry.method} ${entry.path} (${routeKey(entry)})`,
      ),
    ).toEqual([
      'GET /library/:id (LibraryController.get)',
      'GET /library/extra (LibraryController.extra)',
      'GET /library (LibraryController.list)',
      'POST /library/:id/retire (LibraryController.retire)',
    ]);
  });

  it('applies the subclass guards and version to inherited routes', () => {
    expect(entries.every((entry) => entry.guarded)).toBe(true);
    expect(entries.every((entry) => entry.version === '2')).toBe(true);
  });
});
