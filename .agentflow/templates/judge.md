Judge whether the run is approved, needs fixes, or blocked.

Goal:
{{json goal}}

Checks:
{{json checks.latest}}

Reviews:
{{json reviewResults}}

Return JSON only between:
AGENTFLOW_VERDICT_JSON_START
{"verdict":"approved","confidence":0.9,"summary":"Short explanation","requiredFixes":[],"optionalFixes":[],"risks":[],"commitAllowed":true}
AGENTFLOW_VERDICT_JSON_END
