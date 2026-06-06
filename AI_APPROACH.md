# AI Approach

How the Meeting Intelligence Service uses an LLM to extract **grounded, cited** insights from transcripts — and how it prevents hallucination.

Model: **Groq · `llama-3.3-70b-versatile`**, called with `response_format: { type: "json_object" }`.
Implementation: [`src/lib/groq.ts`](src/lib/groq.ts).

---

## 1. Prompt Design

The prompt is split into a **system** message (the rules and output contract) and a **user** message (the actual data).

**System message** establishes the role ("meticulous meeting analyst") and four non-negotiable rules:

1. Only use information explicitly present in the transcript — no outside knowledge or assumptions.
2. Every insight must include one or more citations, each with a real `timestamp`, `speaker`, and a **verbatim** `quote` from the transcript.
3. Never invent attendees, action items, or decisions.
4. If a category has nothing in the transcript, return an empty array rather than fabricating entries.

It then specifies the **exact JSON shape** to return (`summary`, `actionItems`, `decisions`, `followUpSuggestions`), with no extra keys and no prose.

**User message** provides the meeting title, listed participants, date, and the transcript rendered as deterministic lines:

```
[00:01] Jane: Let's ship the API by Friday.
[00:02] John: I'll own the deployment.
```

This `[timestamp] speaker: text` format mirrors the citation fields, making it easy for the model to copy exact timestamps/speakers/quotes back out.

A low temperature (`0.2`) keeps the extraction faithful and repeatable rather than creative.

---

## 2. How Citations Are Enforced

- The **output schema** makes `citations` a required array on every summary point, action item, decision, and follow-up.
- The prompt explicitly instructs the model that timestamps and speakers must match the transcript and quotes must be copied **verbatim**.
- Because the transcript is fed in the same `[timestamp] speaker: text` shape as the citation fields, the model has the exact tokens to copy, which raises citation fidelity.
- After parsing, Zod requires each citation to have `timestamp`, `speaker`, and `quote` strings — output missing these fails validation and the request errors rather than returning uncited "insights."

---

## 3. Hallucination Prevention (defense in depth)

1. **JSON mode** (`response_format: json_object`) — guarantees syntactically valid JSON, removing a whole class of parse failures and "chatty" responses.
2. **Strict, transcript-only prompting** — the rules forbid outside knowledge, forbid inventing entities, and require empty arrays when evidence is absent.
3. **Citation requirement** — forcing every claim to carry a transcript-grounded quote discourages fabricated content, because there's nothing to cite for invented facts.
4. **Low temperature** — reduces creative drift.
5. **Schema validation on the way out** — the parsed object is checked against a Zod schema; anything off-contract is rejected.

These layers are independent: even if the model ignores one instruction, another check catches the failure.

---

## 4. Output Validation Strategy

In `analyzeTranscript()`:

1. Read `choices[0].message.content`; error if empty.
2. `JSON.parse` it; on failure throw `"Groq returned invalid JSON"`.
3. Validate against a Zod `analysisSchema` (citation objects, required fields, array shapes). On failure we log the Zod issues with the trace ID and throw `"AI analysis did not match the expected schema"`.
4. Only validated output is persisted.

**Persistence** (in `meetings.service.ts`) happens in a single Prisma transaction:
- Upsert the `MeetingAnalysis` row (re-running `/analyze` overwrites rather than duplicating).
- Create an `ActionItem` (status `PENDING`) for each entry in `actionItems`, copying its `citations`. Empty/blank assignees fall back to `"unassigned"`; invalid/absent due dates become `null`.

---

## 5. Known Limitations

- **Citation accuracy isn't formally verified.** We require citations to be *present and well-formed*, but we don't programmatically check that each `quote` is a substring of the transcript. The model is strongly instructed to copy verbatim; a stricter post-check (substring match against the source line) is a natural next step.
- **Schema-valid ≠ semantically perfect.** JSON mode + Zod guarantee structure, not judgment. The model can still mis-summarize or mis-attribute within a valid shape.
- **Synchronous analysis.** `/analyze` blocks on the model call; very long transcripts may be slow or hit token limits. A background job/queue would scale better.
- **Single model, no fallback.** If Groq is unavailable or rate-limited, `/analyze` returns an error rather than degrading to another provider.
- **No streaming.** Results are returned only after full generation.
- **Due-date parsing is best-effort.** The model may return natural-language or null due dates; we coerce parseable ISO dates and otherwise store `null`.
