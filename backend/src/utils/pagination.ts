export function parsePagination(page?: unknown, pageSize?: unknown) {
  const parsedPage = Number(page ?? 1);
  const parsedPageSize = Number(pageSize ?? 10);

  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const safePageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(Math.floor(parsedPageSize), 100)
      : 10;

  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize
  };
}
