import { Controller, Get, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { AppException } from '../common/errors/app.exception';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Public()
  @ApiOkResponse({ description: 'Süreç ve veritabanı erişilebilir.' })
  async getHealth(): Promise<{ data: { status: 'ok'; database: 'up'; timestamp: string } }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new AppException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'DATABASE_UNAVAILABLE',
        'Veritabanına ulaşılamıyor.',
      );
    }
    return { data: { status: 'ok', database: 'up', timestamp: new Date().toISOString() } };
  }
}
