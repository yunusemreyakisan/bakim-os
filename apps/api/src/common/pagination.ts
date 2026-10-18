import type { PageMeta } from '@bakimos/api-contracts';

export function pageMeta(page: number, pageSize: number, total: number): PageMeta {
  return {
    page,
    pageSize,
    total,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

export function pageArgs(
  page = 1,
  pageSize = 20,
): { skip: number; take: number; page: number; pageSize: number } {
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}
