# infra/terraform/modules/observability/outputs.tf · intentionally deferred (NOT a silent stub).
# The lean launch tier runs observability IN-CLUSTER via kube-prometheus-stack (Prometheus + Grafana +
# Alertmanager) — no managed-service cost. See infra/k8s/observability/ + infra/OBSERVABILITY-RUNBOOK.md.
# If you later move to Amazon Managed Prometheus/Grafana (AMP/AMG) for multi-cluster scale, this module is where
# that Terraform goes. Tracked in infra/terraform/PROGRESS-P0-1.md.
