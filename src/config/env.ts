import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().refine(
    (url) => url.startsWith("postgres://") || url.startsWith("postgresql://"),
    { message: "DATABASE_URL must be a valid PostgreSQL connection string" }
  ),
  PODMAN_SOCKET_PATH: z.string().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),
  LANGFUSE_BASE_URL: z.string().url().optional(),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(rawEnv: Record<string, string | undefined> = process.env): Environment {
  const isTestRuntime = rawEnv.NODE_ENV === "test" || Boolean(rawEnv.CI);
  const resolvedEnv = {
    ...rawEnv,
    DATABASE_URL: rawEnv.DATABASE_URL || (isTestRuntime ? "postgresql://postgres:postgres@localhost:5432/test_db" : undefined),
  };

  const result = environmentSchema.safeParse(resolvedEnv);
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join(", ");
    throw new Error(`Invalid environment configuration: ${errorDetails}`);
  }
  return result.data;
}

export const env = parseEnvironment();
