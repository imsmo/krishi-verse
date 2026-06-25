{{- define "krishiverse-common.pdb" -}}
{{- if .Values.pdb.enabled -}}
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {{ include "krishiverse-common.fullname" . }}
  labels:
    {{- include "krishiverse-common.labels" . | nindent 4 }}
spec:
  minAvailable: {{ .Values.pdb.minAvailable }}
  selector:
    matchLabels:
      {{- include "krishiverse-common.selectorLabels" . | nindent 6 }}
{{- end -}}
{{- end -}}
