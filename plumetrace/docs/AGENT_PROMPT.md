# The prompt every teammate gives their AI agent

Paste this at the start of every coding session. **Change only the NAME** on the first line
(one of: Yasho1, Yasho2, Tejas, Tanmay, Khare).

---

```
I am <NAME> on the PlumeTrace team.

Onboard before writing any code:
1. Read CLAUDE.md (the hard rules), then docs/team/<NAME>.md (my playbook), then PROJECT_PLAN.md §3–§6.
2. Read the brief sections my playbook's "Read first" lists (docs/PROJECT_BRIEF.md). Where the
   brief and docs/DECISIONS.md disagree, DECISIONS.md wins; otherwise the brief wins.
3. List my files from the playbook's "You own" section and show me each one's STATUS
   (TODO / WIP / DONE) by reading its header.

Then work through MY tasks, following these rules:

RULE 1 — Ignore all DUE times and clock times. The DUE dates (D1 13:00, etc.) and the task-list
  order are ONLY a priority ordering, never deadlines to pace against or wait for. We finish as
  early as possible. Never pause, sleep, or say "this isn't due yet" — always pull the next task
  forward and keep going until I stop you or you are genuinely blocked.

RULE 2 — Work in the 6 phases below, in order. Finish a phase's "exit check" for my files before
  starting the next phase. If a task in a later phase is unblocked and I'm idle, do it early.

RULE 3 — Edit ONLY files whose header OWNER is <NAME>. If I need a change in someone else's file,
  append a row to docs/HANDOFFS.md and tell me who to ping — do not edit it yourself.

RULE 4 — contracts/ is frozen. Never change a schema, mock, or event shape. Code against the
  contracts and against mocks, never against another person's internals.

RULE 5 — Build in mock/local mode first so I am never blocked waiting on a teammate:
  API → MOCK_MODE=1, Python → PT_LOCAL=1, web → VITE_USE_MOCKS=1, Lambdas → feed contract-shaped
  JSON from contracts/mocks. Only switch to real data at Phase 3.

RULE 6 — Keep the file header on every file and update its STATUS (TODO→WIP→DONE). A file is DONE
  only when its header's "DONE WHEN" check actually passes — run the test/build and show me.

RULE 7 — Never commit secrets, keys, .env, or data files. Use .env.example for names only.
  Follow brief §7 for any user-facing text (UTC in storage, IST in UI, numbers as "31 % (22–40 %)").
  Match the code style of the Yasho321/NotebookLM-Clone repo.

RULE 8 — Work in small steps. After each file: run its check, set STATUS=DONE, and give me a
  one-line summary + the exact command you ran. Make focused commits on a branch named
  <NAME>/<feature>; don't push to main. Ask before anything hard to reverse (deploy, delete, spend).

Start now: tell me which phase I'm in based on my files' STATUS, then begin my next unfinished task.
```

---

## The 6 phases (same for the whole team)

| Phase | Name | What it means for everyone | Exit check (team-wide) |
|---|---|---|---|
| **0** | **Onboard** | Read the rules, the playbook and the contracts. Know your files and their current STATUS. | You can list your tasks and say which phase you're in. |
| **1** | **Foundation on mocks** | Yasho2 freezes `contracts/` + mocks. Everyone else scaffolds their area and builds the first pieces against mocks/local mode. Tejas stands up AWS access, secrets, the GFS sample and DataStack. | Contracts frozen; your scaffold builds/lints; your area runs in mock/local mode with no errors. |
| **2** | **Core build on mocks** | Build the bulk of your module against mocks: engine math, API + agent loop, all web views, gov/fleet Lambdas, CDK stacks. Nothing depends on anyone's real output yet. | Your module's unit tests pass on mocks; the happy path works end-to-end in mock mode. |
| **3** | **Real integration (Checkpoint 1)** | Real data replaces mocks: the first real engine run, real API reads, the scheduler turned ON, `forecast.published` triggering gov + fleet. Switch your code off mocks. | docs/INTEGRATION.md "Checkpoint 1" boxes for your area are ticked. |
| **4** | **Close the loop (Checkpoint 2)** | The full chain works: ask the Copilot "what should we do?" → drafts → approve → real delivery → next-day verification + skill page. | docs/INTEGRATION.md "Checkpoint 2" boxes for your area are ticked; the relevant AC (brief §17) passes. |
| **5** | **Polish & demo** | Bug-fix only, performance, UI polish, README, cost, slides, demo script, backup video. Internal feature freeze, then the official freeze. | Your acceptance criteria pass; demo rehearses cleanly; nothing in your area is red. |

> The DUE times in the files just order the work inside these phases. **There are no deadlines to wait for — only the next task to pull forward.**
