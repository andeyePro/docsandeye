total: 356 passed: 356 failed: 0
key failures: none (vitest 356/356 green across all 16 test files; python3 -m unittest discover -s render/tests -t render: 126 tests, OK, 1 skipped — openscad not installed, unrelated to this task)
Regressions: none — build.test.ts's 3 updated assertions (registering-script element count/size, vid-02-seat encoded contract, reshoot table order) and cli.test.ts's updated budget/--strict assertions all pass against the new v0.2 behaviour; no other pre-existing assertion was weakened
