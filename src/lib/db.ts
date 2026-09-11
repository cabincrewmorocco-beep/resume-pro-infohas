// MOCKED Prisma DB client for in-memory and client-side operation
const noOp = {
  findMany: async () => [],
  findFirst: async () => null,
  findUnique: async () => null,
  create: async (d: any) => d?.data ?? {},
  update: async (d: any) => d?.data ?? {},
  delete: async () => ({}),
  count: async () => 0,
};

export const db: any = new Proxy({}, {
  get: () => new Proxy({}, { get: () => async () => noOp }),
});
