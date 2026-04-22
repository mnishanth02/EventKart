# Migration Rollbacks

Every migration in `drizzle/` **must** have a companion rollback SQL file in this directory.

## Convention

| Migration file | Rollback file |
| --- | --- |
| `drizzle/0001_cool_name.sql` | `drizzle/rollbacks/0001_cool_name.rollback.sql` |

- **Naming:** Replace `.sql` with `.rollback.sql`, keeping the same base name.
- **Exemption:** The initial migration (`0000_*`) is exempt because it bootstraps the database from scratch.
- **Content:** Write the reverse of every statement in the migration — `DROP TABLE`, `DROP INDEX`, `ALTER TABLE … DROP COLUMN`, etc.
- **Testing:** Always test rollbacks against a real database before merging.

## Example

If `drizzle/0001_add_events_table.sql` contains:

```sql
CREATE TABLE "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" varchar(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "events_title_idx" ON "events" USING btree ("title");
```

Then `drizzle/rollbacks/0001_add_events_table.rollback.sql` should contain:

```sql
DROP INDEX IF EXISTS "events_title_idx";
DROP TABLE IF EXISTS "events";
```

> **Tip:** Rollback statements should be written in reverse order of the migration statements so that dependent objects are removed first.

## CI Validation

The `db:check:rollbacks` script validates that every non-initial migration has a non-empty rollback file. It runs automatically in CI.
