import type { ExtendedColumnFilter, JoinOperator } from '~/components/data-table/types/data-table';

/**
 * Apply client-side filters to data array
 */
export function applyDataGridFilters<TData>(
  data: TData[],
  filters: ExtendedColumnFilter<TData>[],
  joinOperator: JoinOperator,
): TData[] {
  if (filters.length === 0) return data;

  return data.filter((row) => {
    const results = filters.map((filter) => {
      const rowValue = (row as Record<string, unknown>)[filter.id];
      return evaluateFilter(rowValue, filter);
    });

    return joinOperator === 'or' ? results.some(Boolean) : results.every(Boolean);
  });
}

function evaluateFilter<TData>(rowValue: unknown, filter: ExtendedColumnFilter<TData>): boolean {
  const { operator, value, variant } = filter;

  // Handle empty operators
  if (operator === 'isEmpty') {
    return rowValue === null || rowValue === undefined || rowValue === '' || (typeof rowValue === 'string' && rowValue.trim() === '');
  }
  if (operator === 'isNotEmpty') {
    return rowValue !== null && rowValue !== undefined && rowValue !== '' && !(typeof rowValue === 'string' && rowValue.trim() === '');
  }

  // Skip if value is empty for other operators
  if (!value || (Array.isArray(value) && value.length === 0)) {
    return true; // Don't filter out if no value provided
  }

  // Handle null/undefined row values for comparison operators
  if (rowValue === null || rowValue === undefined) {
    return false; // Null values don't match any comparison (except isEmpty/isNotEmpty which are handled above)
  }

  // Handle array values (like emails)
  if (Array.isArray(rowValue)) {
    const arrayString = rowValue.join(', ').toLowerCase();
    const filterValue = Array.isArray(value) ? value.map(String) : String(value);
    const filterValueLower = Array.isArray(filterValue)
      ? filterValue.map((v) => v.toLowerCase())
      : filterValue.toLowerCase();

    switch (operator) {
      case 'iLike':
        return arrayString.includes(filterValueLower as string);
      case 'notILike':
        return !arrayString.includes(filterValueLower as string);
      case 'eq':
        if (Array.isArray(filterValue)) {
          return filterValue.some((v) => arrayString.includes(v.toLowerCase()));
        }
        return arrayString.includes(filterValueLower);
      case 'inArray':
        if (!Array.isArray(value)) return true;
        return value.some((v) => rowValue.includes(String(v)));
      case 'notInArray':
        if (!Array.isArray(value)) return true;
        return !value.some((v) => rowValue.includes(String(v)));
      default:
        return true;
    }
  }

  const stringValue = String(rowValue).toLowerCase();
  const filterValue = Array.isArray(value) ? value.map(String) : String(value);
  const filterValueLower = Array.isArray(filterValue)
    ? filterValue.map((v) => v.toLowerCase())
    : filterValue.toLowerCase();

  switch (operator) {
    case 'iLike':
      return stringValue.includes(filterValueLower as string);
    case 'notILike':
      return !stringValue.includes(filterValueLower as string);
    case 'eq':
      if (Array.isArray(filterValue)) {
        return filterValue.some((v) => stringValue === v.toLowerCase());
      }
      return stringValue === filterValueLower;
    case 'ne':
      if (Array.isArray(filterValue)) {
        return !filterValue.some((v) => stringValue === v.toLowerCase());
      }
      return stringValue !== filterValueLower;
    case 'lt':
      return Number(rowValue) < Number(value);
    case 'lte':
      return Number(rowValue) <= Number(value);
    case 'gt':
      return Number(rowValue) > Number(value);
    case 'gte':
      return Number(rowValue) >= Number(value);
    case 'isBetween': {
      if (!Array.isArray(value) || value.length < 2) return true;
      const numValue = Number(rowValue);
      return numValue >= Number(value[0]) && numValue <= Number(value[1]);
    }
    case 'inArray':
      if (!Array.isArray(value)) return true;
      return value.some((v) => stringValue === String(v).toLowerCase());
    case 'notInArray':
      if (!Array.isArray(value)) return true;
      return !value.some((v) => stringValue === String(v).toLowerCase());
    default:
      return true;
  }
}

