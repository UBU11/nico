import { describe, expect, it } from "bun:test";
import { parseEnvironment } from "../src/config/env";

describe("Environment Configuration Unit Tests", () => {
  it("parses valid configuration with defaults", () => {
    const config = parseEnvironment({
      DATABASE_URL: "postgresql://user:pass@ep-test-pooler.neon.tech/neondb",
    });

    expect(config.DATABASE_URL).toBe("postgresql://user:pass@ep-test-pooler.neon.tech/neondb");
    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe("development");
  });

  it("throws descriptive error for missing or invalid DATABASE_URL", () => {
    expect(() => parseEnvironment({ DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL must be a valid PostgreSQL connection string/
    );

    expect(() => parseEnvironment({})).toThrow(/Invalid environment configuration/);
  });
});
