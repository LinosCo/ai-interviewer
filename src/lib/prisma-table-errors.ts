type PrismaTableError = {
  code?: string;
  meta?: {
    table?: string;
  };
  message?: string;
};

export function isMissingPrismaTable(error: unknown, tableNames?: string[]): boolean {
  if (!error || typeof error !== 'object') return false;

  const prismaError = error as PrismaTableError;
  if (prismaError.code !== 'P2021') return false;
  if (!tableNames?.length) return true;

  const tableRef = String(prismaError.meta?.table || '').toLowerCase();
  const messageRef = String(prismaError.message || '').toLowerCase();

  return tableNames.some((tableName) => {
    const normalized = tableName.toLowerCase();
    return tableRef.includes(normalized) || messageRef.includes(normalized);
  });
}
