# DEMO_SCRIPT.md

> OWNER    : Khare
> DUE      : D3 20:00
> TASK     :
>   3-minute script from §19 with exact clicks, who speaks, fallback steps (cached run_id, backup video), and the phone that receives the alert.
> DONE WHEN: Rehearsed 3x on D4.
> GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
> STATUS   : DONE

## 0:00–0:20: The Problem
**Speaker:** Tanmay
**Action:** Show slide 1.
**Script:** "The smog season is happening right now in Delhi. Every year people argue about its causes. Meanwhile, the delivery riders who deliver our food breathe it anyway. Today, we'll show how PlumeTrace addresses this end-to-end."

## 0:20–1:00: The Engine
**Speaker:** Tanmay
**Action:** Switch to PlumeTrace Web Dashboard. Click "Live Map" tab. Drag the 72-hour forecast slider from left to right.
**Script:** "Here is our engine. You can see the live fire dots in Punjab, and the animated trajectories showing smoke flowing into Delhi. Our model estimates that 31% of tomorrow morning's PM2.5 in Delhi will come from crop fires, with Sangrur and Patiala leading."
*Fallback:* If map fails to load, switch to cached run `pt_demo_run_01` locally.

## 1:00–2:00: The Agent
**Speaker:** Yasho
**Action:** Open chat UI. Type: "Tomorrow morning looks severe. What should we do?"
**Script:** "Let's ask the PlumeTrace Agent what we should do."
**Action:** Agent streams tool calls on screen. It drafts 2 district reports and 1 farmer alert. Click the "Approvals" tab.
**Script:** "The agent has automatically drafted a district report for Sangrur and a Punjabi farmer alert. It also ran the fleet replanner, saving 34% of worst-rider exposure at the cost of just 6 extra minutes on average."
**Action:** Click "Approve" on the Farmer Alert.
**Speaker:** Khare
**Action:** Hold up phone to the camera/mic.
**Script:** "I have the test phone right here. Once approved, it uses Telegram to deliver the alert."
*(Phone buzzes loudly within 5 seconds. Audio of the Hindi Polly synthesis plays).*

## 2:00–2:30: The Proof
**Speaker:** Yasho
**Action:** Click the "Verification" tab.
**Script:** "We don't just act; we verify. Here is our Forecast Skill showing we outperform baseline persistence. And here is the verification from our farmer alerts from yesterday, showing an estimated 15% reduction in fires compared to control districts."

## 2:30–3:00: Architecture and Cost
**Speaker:** Tanmay
**Action:** Show final architecture slide.
**Script:** "All of this runs 100% serverless on AWS EventBridge, Lambda, and DynamoDB. It costs roughly $5 a day. Next, we want to expand to more cities and integrate real fleet APIs like Zomato."

## Fallbacks
- If live dashboard fails: Play the pre-recorded backup video (D4 rehearsal).
- If Polly/Telegram fails: Play the pre-downloaded `demo_audio_backup.mp3` from the laptop speakers.
