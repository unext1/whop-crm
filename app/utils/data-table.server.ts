import type { ColumnDef } from '@tanstack/react-table';
import type { AnyColumn } from 'drizzle-orm';
import { and, asc, desc, eq, gt, gte, isNotNull, isNull, like, lt, lte, ne, not, or, type SQL } from 'drizzle-orm';
import { getFiltersStateParser, getSortingStateParser } from '~/components/data-table/parsers';
import type { ExtendedColumnFilter, ExtendedColumnSort, JoinOperator } from '~/components/data-table/types/data-table';

interface ParsedTableState<TData> {
  filters: ExtendedColumnFilter<TData>[];
  sorting: ExtendedColumnSort<TData>[];
  joinOperator: JoinOperator;
  page: number;
  perPage: number;
}

/**
 * Extract column IDs from column definitions
 */
export const getColumnIds = <TData>(columns: ColumnDef<TData>[]): string[] =>
  columns.filter((col) => col.enableColumnFilter && col.id).map((col) => col.id as string);

/**
 * Parse data table state from URL search params (React Router v7 loader)
 */
export const parseDataTableSearchParams = <TData>(
  searchParams: URLSearchParams,
  columnIds: string[],
): ParsedTableState<TData> => {
  const filtersParser = getFiltersStateParser<TData>(columnIds);
  const sortingParser = getSortingStateParser<TData>(columnIds);

  // Parse filters
  const filtersParam = searchParams.get('filters');
  const filters = filtersParam ? (filtersParser.parse(filtersParam) ?? []) : [];

  // Parse sorting
  const sortParam = searchParams.get('sort');
  const sorting = sortParam ? (sortingParser.parse(sortParam) ?? []) : [];

  // Parse join operator
  const joinOperatorParam = searchParams.get('joinOperator');
  const joinOperator = (joinOperatorParam === 'or' ? 'or' : 'and') as JoinOperator;

  // Parse pagination
  const page = Number(searchParams.get('page')) || 1;
  const perPage = Number(searchParams.get('perPage')) || 10;

  return {
    filters,
    sorting,
    joinOperator,
    page,
    perPage,
  };
};

/**
 * Build Drizzle WHERE clause from data table filters
 */
export const buildWhereClause = <TData>(
  filters: ExtendedColumnFilter<TData>[],
  joinOperator: JoinOperator,
  columnMap: Record<string, AnyColumn>,
  customColumnHandlers?: Record<string, (filter: ExtendedColumnFilter<TData>) => SQL | undefined>,
): SQL | undefined => {
  if (filters.length === 0) return undefined;

  const conditions: SQL[] = [];

  for (const filter of filters) {
    // Check if there's a custom handler for this column
    const customHandler = customColumnHandlers?.[filter.id];
    if (customHandler) {
      const condition = customHandler(filter);
      if (condition) {
        conditions.push(condition);
      }
      continue;
    }

    // Use default column mapping
    const column = columnMap[filter.id];
    if (!column) continue;

    const condition = buildFilterCondition(filter, column);
    if (condition) {
      conditions.push(condition);
    }
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];

  return joinOperator === 'or' ? or(...conditions) : and(...conditions);
};

/**
 * Convert timestamp to SQLite date format (YYYY-MM-DD HH:MM:SS)
 */
const timestampToSQLiteDate = (timestamp: string | number): string => {
  const date = new Date(Number(timestamp));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

/**
 * Build a single filter condition based on operator
 */
const buildFilterCondition = <TData>(filter: ExtendedColumnFilter<TData>, column: AnyColumn): SQL | undefined => {
  const { operator, value, variant } = filter;

  // Handle empty operators
  if (operator === 'isEmpty') {
    return or(isNull(column), eq(column, ''));
  }
  if (operator === 'isNotEmpty') {
    return and(isNotNull(column), ne(column, ''));
  }

  // Skip if value is empty for other operators
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return undefined;
  }

  // Helper to convert date values if needed
  const isDateVariant = variant === 'date' || variant === 'dateRange';
  const convertValue = (val: string | number) => {
    if (isDateVariant && typeof val === 'string' && !Number.isNaN(Number(val))) {
      return timestampToSQLiteDate(val);
    }
    return val;
  };

  switch (operator) {
    // Text operators (SQLite uses LIKE, case-insensitive)
    case 'iLike':
      return like(column, `%${value}%`);
    case 'notILike':
      return not(like(column, `%${value}%`));

    // Comparison operators
    case 'eq':
      if (Array.isArray(value)) {
        return eq(column, convertValue(value[0]));
      }
      return eq(column, convertValue(value));

    case 'ne':
      if (Array.isArray(value)) {
        return ne(column, convertValue(value[0]));
      }
      return ne(column, convertValue(value));

    case 'lt':
      if (Array.isArray(value)) {
        return lt(column, convertValue(value[0]));
      }
      return lt(column, convertValue(value));

    case 'lte':
      if (Array.isArray(value)) {
        return lte(column, convertValue(value[0]));
      }
      return lte(column, convertValue(value));

    case 'gt':
      if (Array.isArray(value)) {
        return gt(column, convertValue(value[0]));
      }
      return gt(column, convertValue(value));

    case 'gte':
      if (Array.isArray(value)) {
        return gte(column, convertValue(value[0]));
      }
      return gte(column, convertValue(value));

    // Between operator (for ranges and dates)
    case 'isBetween': {
      if (!Array.isArray(value) || value.length < 2) return undefined;
      const [min, max] = value;
      if (!min || !max) return undefined;

      const minValue = convertValue(min);
      const maxValue = convertValue(max);

      return and(gte(column, minValue), lte(column, maxValue));
    }

    // Array operators
    case 'inArray': {
      if (!Array.isArray(value)) return undefined;
      const conditions = value.map((v) => eq(column, v));
      return or(...conditions);
    }

    case 'notInArray': {
      if (!Array.isArray(value)) return undefined;
      const conditions = value.map((v) => ne(column, v));
      return and(...conditions);
    }

    // Date relative operator (custom implementation needed)
    case 'isRelativeToToday': {
      // This would need custom logic based on your requirements
      // For now, treating it as equals
      if (Array.isArray(value)) {
        return eq(column, value[0]);
      }
      return eq(column, value);
    }

    default:
      return undefined;
  }
};

/**
 * Build Drizzle ORDER BY clause from data table sorting
 */
export const buildOrderByClause = <TData>(
  sorting: ExtendedColumnSort<TData>[],
  columnMap: Record<string, AnyColumn>,
): SQL[] => {
  const orderBy: SQL[] = [];

  for (const sort of sorting) {
    const column = columnMap[sort.id];
    if (!column) continue;

    orderBy.push(sort.desc ? desc(column) : asc(column));
  }

  return orderBy;
};

/**
 * Calculate pagination offset
 */
export const getPaginationParams = (page: number, perPage: number) => {
  const offset = (page - 1) * perPage;
  return { offset, limit: perPage };
};
