# secrets module — production configuration home
Staging/prod NEVER use .env files. This module creates AWS Secrets Manager
entries per app per env:  kv/<env>/api , kv/<env>/wallet , kv/<env>/worker
Helm charts mount them as env vars at deploy (see infra/helm/*/values.yaml →
envFrom.secretRef). Rotation: 90 days, automated. Humans read via
`aws secretsmanager get-secret-value` with audited IAM roles — never Slack.
