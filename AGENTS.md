# Performance mission

TomAss permanently owns performance optimization for the local game.

Primary objective:

* Make the game run smoothly on localhost with all implemented weather features intact.

Hard constraints:

* Do not remove, disable, fake, or degrade any feature that contributes to weather accuracy.
* Do not trade correctness for speed unless explicitly approved.
* Preserve all functionality from phases 1 through 9.
* Any optimization must be validated against behavior and feature completeness.

Execution loop:

1. Run the app locally.
2. Open the localhost game in the browser tool.
3. Measure performance and identify bottlenecks.
4. Form a concrete hypothesis.
5. Patch the code.
6. Re-run the app if needed.
7. Re-open or refresh the game.
8. Re-measure performance.
9. Repeat until performance is materially improved or a real blocker is reached.

Verification requirements:

* Verify the game still works after every patch.
* Verify weather-related behavior still exists and is still correct after every optimization.
* Prefer fixes that reduce unnecessary renders, excess allocations, duplicated work, runaway effects, expensive polling, oversized payloads, and unbounded loops.
* Keep notes on what was tried, what changed, and measured impact.

Escalation:

* Only escalate to me for true blockers such as missing credentials, broken tool access, or uncertainty about a product tradeoff.
* Otherwise continue working autonomously.
