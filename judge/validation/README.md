# Isolated catalog validation

Run from the project root using Node 24 or newer:

```sh
node --env-file=.env.executor --experimental-transform-types scripts/validate-catalog-solutions.ts
```

The runner imports private evaluation fixtures on the host, but sends all solution code to the authenticated Docker executor. It does not evaluate or import submitted solution code on the host. Tokens and hidden inputs are never printed. The incremental report defaults to `/tmp/rods-catalog-validation.json`.

Optional environment variables:

- `VALIDATE_CHALLENGES`: comma-separated challenge IDs.
- `VALIDATION_REPORT`: output JSON path.
- `VALIDATE_BASELINE_LANGUAGE`: optionally execute one editorial baseline per selected challenge in JavaScript, TypeScript, Python or SQL, instead of the three syntax variants. Use only challenges whose editorial is actually available in that language.
- `LOCAL_EXECUTOR_URL`: existing gateway URL, default `http://127.0.0.1:8789`.

Every challenge has three different source forms. Sum uses a named function with local variables, a destructuring arrow, and a custom helper called by the required exported function. Other programming challenges convert the canonical solution into a named function, an arrow, and a helper with diagnostic output. SQL uses the original query, a subquery, and a CTE.

These are syntax and integration variants of the same algorithm, not three independent algorithm correctness proofs. They validate public and hidden comparisons, diagnostics preceding the return value, SQL columns/types/order, multiple parameter forwarding, and the `find-max` input immutability envelope. The runner also reproduces a custom function lacking the required exported entry point; this must produce a runtime error.

The fixture coverage unit test only checks completeness and distinct source forms. Successful unit tests do not establish runtime compatibility: the isolated runner must finish with zero failures.
