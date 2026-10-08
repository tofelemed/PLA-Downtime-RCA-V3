/** Offset-paged v1 list response, returned only when the client asks for `page`/`pageSize`. */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
