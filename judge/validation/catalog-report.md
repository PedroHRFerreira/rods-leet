# Catalog validation — 30 September 2026

59 code challenges, three different source forms per challenge: **177/177 passed**. All public and hidden cases were executed in the isolated Docker gateway; learner code never ran on the host.

These are syntax/integration variants of the canonical algorithm, not independent correctness proofs. Sum uses three hand-authored forms; the other functions use named/arrow/helper forms, with diagnostic logging in the helper. SQL uses direct/subquery/CTE forms.

The catalog now additionally includes 10 concept questionnaires. They do not run code and are not counted among these 177 runtime variants. Their answer grading and public content contract are validated separately in the questionnaire tests.

## Runtime findings

- The custom `teste(a, b)` function without an exported `solve` reproduces a runtime error; the evaluation contract requires the model entry point.
- All three correct sum implementations passed the example, zero/negative values and private cases.
- Diagnostic logs survive execution and do not replace the final return value used in comparisons.
- `find-max` variants passed the nonmutation contract.
- SQL initially exposed text as byte representations and failed to seed accented values. UTF-8 on both privileged and student connections fixed all 30 SQL variants without weakening comparisons.

## Per challenge

| Challenge                | Language   | Public cases | Hidden cases | Variants | Status |
| ------------------------ | ---------- | -----------: | -----------: | -------: | ------ |
| literal-number           | javascript |            1 |            1 |        3 | Passed |
| literal-text             | javascript |            1 |            1 |        3 | Passed |
| named-value              | javascript |            1 |            1 |        3 | Passed |
| console-and-return       | javascript |            1 |            1 |        3 | Passed |
| input-echo               | javascript |            2 |            5 |        3 | Passed |
| function-double          | javascript |            2 |            5 |        3 | Passed |
| sum-two-integers         | javascript |            2 |            3 |        3 | Passed |
| variable-bonus           | javascript |            2 |            3 |        3 | Passed |
| is-even-integer          | javascript |            3 |            4 |        3 | Passed |
| find-max                 | javascript |            3 |            8 |        3 | Passed |
| sum-even                 | javascript |            2 |            5 |        3 | Passed |
| count-vowels             | javascript |            2 |            4 |        3 | Passed |
| is-palindrome            | javascript |            2 |            6 |        3 | Passed |
| fizzbuzz                 | javascript |            2 |            4 |        3 | Passed |
| leap-year                | javascript |            3 |            6 |        3 | Passed |
| digit-sum                | javascript |            2 |            4 |        3 | Passed |
| interval-overlap         | javascript |            2 |            4 |        3 | Passed |
| roman-numeral            | javascript |            2 |            8 |        3 | Passed |
| expression-eval          | javascript |            2 |            6 |        3 | Passed |
| binary-search            | javascript |            2 |            4 |        3 | Passed |
| two-sum                  | javascript |            2 |            5 |        3 | Passed |
| merge-sorted             | javascript |            2 |            4 |        3 | Passed |
| rotate-array             | javascript |            2 |            4 |        3 | Passed |
| gcd                      | javascript |            2 |            5 |        3 | Passed |
| anagram-groups           | javascript |            1 |            4 |        3 | Passed |
| sliding-window-max       | javascript |            1 |            4 |        3 | Passed |
| longest-unique-substring | javascript |            3 |            5 |        3 | Passed |
| coin-change              | javascript |            2 |            4 |        3 | Passed |
| interval-merge           | javascript |            2 |            5 |        3 | Passed |
| topological-sort         | javascript |            2 |            5 |        3 | Passed |
| shortest-path            | typescript |            2 |            6 |        3 | Passed |
| edit-distance            | javascript |            2 |            5 |        3 | Passed |
| knapsack                 | javascript |            2 |            4 |        3 | Passed |
| max-subarray             | javascript |            2 |            5 |        3 | Passed |
| stack-ops                | javascript |            1 |            4 |        3 | Passed |
| queue-ops                | javascript |            1 |            3 |        3 | Passed |
| balanced-brackets        | javascript |            3 |            6 |        3 | Passed |
| frequency-map            | javascript |            2 |            4 |        3 | Passed |
| linked-list-reverse      | javascript |            2 |            2 |        3 | Passed |
| remove-duplicates        | javascript |            2 |            4 |        3 | Passed |
| bst-search               | javascript |            1 |            3 |        3 | Passed |
| tree-height              | javascript |            2 |            2 |        3 | Passed |
| level-order              | javascript |            1 |            2 |        3 | Passed |
| lru-cache                | javascript |            1 |            3 |        3 | Passed |
| union-find               | javascript |            1 |            2 |        3 | Passed |
| trie-prefix              | javascript |            1 |            3 |        3 | Passed |
| range-sum                | javascript |            1 |            2 |        3 | Passed |
| median-stream            | javascript |            2 |            6 |        3 | Passed |
| heap-top-k               | javascript |            2 |            4 |        3 | Passed |
| sql-active-orders        | sql        |            1 |            3 |        3 | Passed |
| sql-customer-count       | sql        |            1 |            3 |        3 | Passed |
| sql-order-owner          | sql        |            1 |            3 |        3 | Passed |
| sql-no-orders            | sql        |            1 |            3 |        3 | Passed |
| sql-customer-spend       | sql        |            1 |            3 |        3 | Passed |
| sql-above-average        | sql        |            1 |            3 |        3 | Passed |
| sql-second-salary        | sql        |            1 |            3 |        3 | Passed |
| sql-running-score        | sql        |            1 |            3 |        3 | Passed |
| sql-top-players          | sql        |            1 |            3 |        3 | Passed |
| sql-reporting-tree       | sql        |            1 |            3 |        3 | Passed |

Total case executions: **981**.

Corrected SQL executor image: `sha256:2ef3a4758df9ed1cb5af52d0a9b5907b2d09dce5ee9ab20150a1ba81f280b3a4`.

The manifest hash identifies the gateway manifest document, not the Docker image digest. Earlier programming runs used the previous image; only SQL connections changed in the corrected image.

## Additional beginner language baselines

The six new beginner lessons also passed their Python and TypeScript editorial baselines: **12/12 extra executions**, covering all public and hidden cases. These are additional language checks, counted separately from the 177 source variants.

| Challenge          | Python | TypeScript | Cases per language |
| ------------------ | ------ | ---------- | -----------------: |
| literal-number     | Passed | Passed     |                  2 |
| literal-text       | Passed | Passed     |                  2 |
| named-value        | Passed | Passed     |                  2 |
| console-and-return | Passed | Passed     |                  2 |
| input-echo         | Passed | Passed     |                  7 |
| function-double    | Passed | Passed     |                  7 |

Additional baseline case executions: **44**. Total including source variants: **1025**.
