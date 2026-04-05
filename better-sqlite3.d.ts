declare module "better-sqlite3" {
  type RunResult = {
    changes: number;
    lastInsertRowid: number | bigint;
  };

  type Statement<Result = Record<string, unknown>> = {
    all(...params: unknown[]): Result[];
    get(...params: unknown[]): Result | undefined;
    run(...params: unknown[]): RunResult;
  };

  class Database {
    constructor(filename: string, options?: Record<string, unknown>);
    close(): this;
    exec(sql: string): this;
    pragma(source: string): unknown;
    prepare<Result = Record<string, unknown>>(sql: string): Statement<Result>;
  }

  namespace Database {
    export { Database as default };
    export type Database = import("better-sqlite3").default;
  }

  export default Database;
}
