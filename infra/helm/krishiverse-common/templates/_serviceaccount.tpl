{{- define "krishiverse-common.serviceaccount" -}}
{{- if .Values.serviceAccount.create -}}
apiVersion: v1
kind: ServiceAccount
metadata:
  name: {{ include "krishiverse-common.serviceAccountName" . }}
  labels:
    {{- include "krishiverse-common.labels" . | nindent 4 }}
  {{- if .Values.serviceAccount.roleArn }}
  annotations:
    eks.amazonaws.com/role-arn: {{ .Values.serviceAccount.roleArn | quote }}
  {{- end }}
{{- end -}}
{{- end -}}
