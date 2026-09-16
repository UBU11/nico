import type { PrometheusQueryOptions, PrometheusQueryResult } from "../../types/diagnostics";

export async function queryPrometheusMetrics(
  options: PrometheusQueryOptions,
  endpoint = process.env.PROMETHEUS_ENDPOINT
): Promise<PrometheusQueryResult> {
  if (!endpoint) {
    return {
      resultType: "vector",
      result: [
        {
          metric: { __name__: options.query },
          value: [Math.floor(Date.now() / 1000), "1.0"],
        },
      ],
    };
  }

  const searchParams = new URLSearchParams({ query: options.query });
  if (options.time) searchParams.set("time", options.time);

  const response = await fetch(`${endpoint}/api/v1/query?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`Prometheus query failed with status ${response.status}: ${await response.text()}`);
  }

  const json = (await response.json()) as {
    data?: { resultType: string; result: Array<{ metric: Record<string, string>; value: [number, string] }> };
  };

  return {
    resultType: json.data?.resultType ?? "vector",
    result: json.data?.result ?? [],
  };
}
