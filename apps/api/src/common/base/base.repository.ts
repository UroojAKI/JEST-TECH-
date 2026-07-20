import { PaginationDto, PaginatedResponseDto } from '../pagination';

export abstract class BaseRepository<T, ModelDelegate> {
  constructor(protected readonly model: ModelDelegate) {}

  /**
   * Reusable pagination query
   */
  async findPaginated(
    paginationDto: PaginationDto,
    where: any = {},
    include?: any,
  ): Promise<PaginatedResponseDto<T>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this.model as any).findMany({
        where,
        include,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      (this.model as any).count({ where }),
    ]);

    return new PaginatedResponseDto<T>(data, total, page, limit);
  }

  async findById(id: string, include?: any): Promise<T | null> {
    return (this.model as any).findUnique({
      where: { id },
      include,
    });
  }

  async create(data: any): Promise<T> {
    return (this.model as any).create({ data });
  }
}
