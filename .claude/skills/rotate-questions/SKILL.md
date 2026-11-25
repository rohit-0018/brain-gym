---
name: rotate-questions
description: Rotate the Brain Gym answer-writing question bank. Use when the user says "rotate questions", "new questions", "refresh the question bank" or "rotate the IAS questions". Writes a fresh batch of UPSC Mains-style subjective questions and makes it the active batch.
---

# Rotate the answer-writing questions

Questions live in `public/ias-bank.js` (`IAS_BANK`, active batch in `IAS_ACTIVE`). The app only serves questions whose `batch === IAS_ACTIVE`, so bumping it rotates everything.

## Steps
1. Read `public/ias-bank.js`. Note the highest `batch` number N and all existing ids and topics (never repeat a topic or id).
2. Write a new batch N+1 of **12 questions** appended to `IAS_BANK` under a `/* ---- Batch N+1 ---- */` comment, with this mix:
   - 4 GS4 Ethics case studies (20 marks, 300 words): a concrete officer-level dilemma, with parts (a) issues (b) options (c) decision.
   - 4 GS1/2/3 analytical questions (15 marks, 250 words): "Critically examine / Discuss / Analyse", on current governance, economy, society, polity, environment, security.
   - 3 GS4 concept/quote questions (10 marks, 150 words).
   - 1 Essay-paragraph prompt (15 marks, 250 words).
3. Every question needs: `id` (unique, e.g. `e2-01`, `g2-05`), `batch`, `paper`, `topic`, `marks`, `words`, `q`, `dims` (3-5 structure hints), `pts` (5-8 concrete model points: facts, articles, cases, committees, schemes, a way forward). Points must be accurate and specific. If unsure of a fact, leave it out.
4. Vary themes. Prefer fresh, realistic scenarios over textbook ones, and keep the language plain.
5. Set `const IAS_ACTIVE = N+1;`. Keep older batches in the file (they are the history; do not delete).
6. Run `npm test` and fix anything in `test/ias.test.js` that fails (ids unique, 5-8 points, active batch >= 8 questions, 3+ papers).
7. Commit with message `Rotate questions to batch N+1` and tell the user the topics covered. Do not push unless asked.
