import { PaginationDto, PaginatedResponseDto } from '../pagination';

// The type for the optional transaction client
export type TransactionClient = any;

export abstract class BaseRepository<ModelDelegate, BasicType, DetailType> {
  constructor(protected readonly model: ModelDelegate) {}

  /**
   * Helper to execute operations either inside a transaction (if tx is provided)
   * or using the standard model.
   */
  protected getClient(tx?: TransactionClient): ModelDelegate {
    return (tx as ModelDelegate) || this.model;
  }

  /**
   * Override these in subclass to provide strict select/include projections.
   */
  protected abstract get basicArgs(): { select?: any; include?: any };
  protected abstract get detailArgs(): { select?: any; include?: any };

  async findPaginated(
    paginationDto: PaginationDto,
    where: any = {},
  ): Promise<PaginatedResponseDto<BasicType>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      (this.model as any).findMany({
        where,
        ...this.basicArgs,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
      (this.model as any).count({ where }),
    ]);

    return new PaginatedResponseDto<BasicType>(data, total, page, limit);
  }

  async findById(
    id: string,
    tx?: TransactionClient,
  ): Promise<DetailType | null> {
    return (this.getClient(tx) as any).findFirst({
      where: { id, deletedAt: null },
      ...this.detailArgs,
    });
  }

  async findBasicById(
    id: string,
    tx?: TransactionClient,
  ): Promise<BasicType | null> {
    return (this.getClient(tx) as any).findFirst({
      where: { id, deletedAt: null },
      ...this.basicArgs,
    });
  }

  async exists(where: any, tx?: TransactionClient): Promise<boolean> {
    const count = await (this.getClient(tx) as any).count({ where });
    return count > 0;
  }

  async count(where: any, tx?: TransactionClient): Promise<number> {
    return (this.getClient(tx) as any).count({ where });
  }

  async create(data: any, tx?: TransactionClient): Promise<DetailType> {
    return (this.getClient(tx) as any).create({
      data,
      ...this.detailArgs,
    });
  }

  async createMany(
    data: any[],
    tx?: TransactionClient,
  ): Promise<{ count: number }> {
    return (this.getClient(tx) as any).createMany({
      data,
      skipDuplicates: true,
    });
  }

  async update(
    id: string,
    data: any,
    tx?: TransactionClient,
  ): Promise<DetailType> {
    return (this.getClient(tx) as any).update({
      where: { id },
      data,
      ...this.detailArgs,
    });
  }

  async delete(id: string, tx?: TransactionClient): Promise<void> {
    await (this.getClient(tx) as any).delete({
      where: { id },
    });
  }

  /**
   * For models with soft deletes, they typically have `deletedAt` and `deletedById`.
   */
  async softDelete(
    id: string,
    deletedById?: string,
    tx?: TransactionClient,
  ): Promise<void> {
    await (this.getClient(tx) as any).update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedById,
      },
    });
  }
}
