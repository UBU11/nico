import type { LokiQueryOptions, LokiQueryResult } from "../../types/diagnostics";

export async function queryLokiLogs(
  options: LokiQueryOptions,
  endpoint = process.env.LOKI_ENDPOINT
): Promise<LokiQueryResult> {
  if (!endpoint) {
    return {
      entries: [
        {
          timestamp: new Date().toISOString(),
          line: `[SIMULATED LOKI] Query: ${options.query}`,
          labels: { app: "service", query: options.query },
        },
      ],
      query: options.query,
      totalFetched: 1,
    };
  }

  const searchParams = new URLSearchParams({
    query: options.query,
    limit: String(options.limit),
  });
  if (options.start) searchParams.set("start", options.start);
  if (options.end) searchParams.set("end", options.end);

  const response = await fetch(`${endpoint}/loki/api/v1/query_range?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`Loki query failed with status ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    data?: { result?: Array<{ stream?: Record<string, string>; values?: [string, string][] }> };
  };

  const entries = (data.data?.result ?? []).flatMap((stream) =>
    (stream.values ?? []).map(([epochNano, line]) => ({
      timestamp: new Date(Number(BigInt(epochNano) / 1000000n)).toISOString(),
      line,
      labels: stream.stream ?? {},
    }))
  );

  return {
    entries,
    query: options.query,
    totalFetched: entries.length,
  };
}
