import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { validate as isUuid } from 'uuid';

/**
 * ParseUUIDPipe — validates that a route parameter is a valid UUID v4.
 *
 * Usage:
 *   @Get(':id')
 *   findOne(@Param('id', ParseUUIDPipe) id: string) { ... }
 *
 * Without this, passing a non-UUID string to any Prisma findUnique/findFirst
 * causes a P2023 error that would leak DB internals to the client.
 */
@Injectable()
export class ParseUUIDPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (!value || !isUuid(value)) {
      throw new BadRequestException(
        `Validation failed: '${metadata.data ?? value}' must be a valid UUID`,
      );
    }
    return value;
  }
}
