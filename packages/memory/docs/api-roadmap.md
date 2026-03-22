# API Roadmap

This document reflects the current v1 core API and the next deferred pieces.

## Constructor

```ts
const memory = new Memory({
	db,
	models: {
		embed,
		summarize,
	},
	now,
});
```

Constructor rules:

- `db` must be a Drizzle PostgreSQL database instance with `execute`, `select`, `insert`, `update`, `delete`, and `transaction`
- `models.embed` must be an AI SDK embedding model instance
- `models.summarize` must be an AI SDK language model instance
- `now` is optional and exists for deterministic tests

## Implemented Methods

### `remember(input)`

Purpose:

- append a new durable memory record

Current behavior:

- validates input
- normalizes metadata
- applies defaults
- optionally generates an embedding
- inserts into `memory_records`
- returns `{ id, createdAt }`

Notes:

- ids are opaque strings
- the database must generate the `id`
- the package does not mutate older rows

### `context(input)`

Purpose:

- return the most relevant memory for the current situation

Current behavior:

- validates `where`, `text`, `limit`, and `includeSummary`
- narrows candidates with metadata filters first
- optionally embeds `text`
- loads structural candidates
- optionally loads semantic candidates
- ranks by semantic relevance, priority, and freshness
- deduplicates near-identical results conservatively
- returns prompt-ready items
- optionally returns a stored summary row as `summary`

Notes:

- `includeSummary` does not generate a summary
- summaries are only surfaced if a matching summary row already exists

### `forget(input)`

Purpose:

- delete one memory item or a filtered set of items

Current behavior:

- supports delete by `id`
- supports delete by `where`
- returns `{ deletedCount }`

## Deferred Runtime API

### `summarize(input)`

Still planned, but not implemented yet.

Intended behavior:

- gather matching items
- summarize them with `models.summarize`
- optionally store a summary row back into `memory_records`

## Query DSL

The supported filter language stays intentionally small:

```ts
{ userId: "user_123" }

{ and: [{ appId: "app_123" }, { userId: "user_123" }] }

{
	and: [
		{ appId: "app_123" },
		{ or: [{ conversationId: "conv_456" }, { topic: "billing" }] },
	],
}
```

Supported now:

- equality
- `and`
- `or`

Out of scope:

- range operators
- `contains`
- nested JSON traversal
- arbitrary SQL
- regex
- `not`
