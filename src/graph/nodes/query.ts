import type { IncidentState } from "../state";
import { queryLokiLogs } from "../../tools/diagnostics/loki";
import { queryPrometheusMetrics } from "../../tools/diagnostics/prometheus";

export async function queryNode(state: IncidentState): Promise<Partial<IncidentState>> {
  const service = state.alert.service;
  const lokiResult = await queryLokiLogs({
    query: `{app="${service}"}`,
    limit: 20,
  });

  const prometheusResult = await queryPrometheusMetrics({
    query: `rate(http_requests_total{app="${service}",status=~"5.."}[5m])`,
  });

  const retrievedLogs = lokiResult.entries.map(
    (e) => `[telemetry:loki] ${e.timestamp} ${e.line}`
  );

  return {
    logs: retrievedLogs.length > 0 ? retrievedLogs : [`[telemetry:loki] No explicit log entries found for ${service}`],
    metrics: {
      lokiEntriesCount: lokiResult.totalFetched,
      prometheusResultType: prometheusResult.resultType,
      sampleMetricCount: prometheusResult.result.length,
    },
  };
}
