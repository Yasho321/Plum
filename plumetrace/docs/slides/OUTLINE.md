# OUTLINE.md

> OWNER    : Khare
> DUE      : D3 20:00
> TASK     :
>   Slide outline following brief §19 (problem, engine, agent, proof, architecture+cost). Every number sourced or labelled estimate. Tanmay designs visuals.
> DONE WHEN: -
> GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
> STATUS   : DONE

## Slide 1: The Problem
- The smog season is happening right now in Delhi.
- Annual arguments about causes continue without clear, automated resolution.
- Delivery riders are disproportionately exposed to PM2.5 while working.

## Slide 2: The PlumeTrace Engine
- **Visuals:** Live map with fire dots in Punjab and animated trajectories flowing into Delhi.
- **Visuals:** 72h forecast slider.
- **Key Insight:** "Our model estimates 31% (22-40%) of tomorrow morning's PM2.5 comes from crop fires; Sangrur and Patiala lead." (Based on mocked data / simulation).

## Slide 3: The AI Agent
- **Scenario:** "Tomorrow morning looks severe. What should we do?"
- **Action:** Show agent tool calls to draft district reports and farmer alerts.
- **Fleet Plan:** Show the proposed shift plan changes ("-34% worst-rider exposure, +6 min average").
- **Demo Live:** Approve actions; show a live phone receiving the Punjabi alert with synthesized audio.

## Slide 4: Proof of Impact
- **Forecast Skill:** Compare PlumeTrace forecast vs simple persistence model (baseline).
- **Verification:** Next-day fire-trend check showing actual impact of alerts vs control districts.

## Slide 5: Architecture and Cost
- **Architecture:** 100% Serverless on AWS (Lambda, EventBridge, S3, DynamoDB).
- **Cost:** ~$5/day (estimate) for regular data ingestion and agent operations.
- **Future Steps:** Expand to more cities, integrate real fleet APIs (Zomato/Swiggy), use Amazon Connect/DLT for automated voice calls instead of Telegram.
