Choose exactly one scoped next goal for {{project.name}}.

Project root: {{projectRoot}}
Thinking: {{thinking.level}} - {{thinking.promptHint}}

Memory:
{{memory.markdown}}

Return JSON only between:
AGENTFLOW_GOAL_JSON_START
{"id":"short-stable-id","title":"Human readable goal title","rationale":"Why this is next","sourceDocuments":[],"scope":{"include":[],"exclude":[]},"acceptanceCriteria":[],"validationCommands":[],"riskLevel":"low"}
AGENTFLOW_GOAL_JSON_END
