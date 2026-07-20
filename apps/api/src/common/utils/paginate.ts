import { PaginationParamsDto } from '../dto/pagination.dto';

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export async function paginate<T>(
  modelDelegate: any,
  params: PaginationParamsDto,
  options?: {
    where?: Record<string, any>;
    include?: Record<string, any>;
    orderBy?: Record<string, any>;
  },
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.max(1, Number(params.limit || 25));
  const skip = (page - 1) * limit;

  const where = options?.where || {};
  const include = options?.include;

  // Build sorting order
  let orderBy = options?.orderBy || {};
  if (params.sortBy) {
    orderBy = {
      [params.sortBy]: params.sortDir || 'desc',
    };
  }

  // Execute database operations in parallel
  const [data, total] = await Promise.all([
    modelDelegate.findMany({
      where,
      include,
      orderBy,
      skip,
      take: limit,
    }),
    modelDelegate.count({
      where,
    }),
  ]);

  const pages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  };
}
