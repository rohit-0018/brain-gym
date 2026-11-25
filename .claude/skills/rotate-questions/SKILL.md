---
name: rotate-questions
description: Rotate the Brain Gym answer-writing question bank. Use when the user says "rotate questions", "new questions", "refresh the question bank" or "rotate the IAS questions". Writes a fresh batch of UPSC Mains-style subjective questions and makes it the active batch.
---

# Rotate the answer-writing questions

Questions live in `public/ias-bank.js` (`IAS_BANK`, active batch in `IAS_ACTIVE`). The app only serves questions whose `batch === IAS_ACTIVE`, so bumping it rotates everything.

## Steps
1. Read `public/ias-bank.js`. Note the highest `batch` number N and all existing ids and topics (never repeat a topic or id).
2. Write a new batch N+1 of about **40 questions**, appended to `IAS_BANK` under a `/* ---- Batch N+1 ---- */` comment, in these three types:
   - **30 `mcq`** (Prelims style): Polity 6, Economy 6, History 5, Geography 5, Environment 5, Science & Tech 3. About a third should be "Consider the following statements... which are correct?" with options like "1 and 2 only". Difficulty `diff` 1-3 with roughly 25/50/25 split. Put the correct `ans` at varied positions (no position over 50%).
   - **8 `case`** (Ethics best-action): a concrete officer-level dilemma and 4 courses of action. `score` array has exactly one 100 and the others at most 60, with a `why` line for each option. Make wrong options tempting (compassion without process, rule-following without humanity, courage without propriety), never silly.
   - **12 `mains`** (written, used by Practice): 4 GS4 case studies (20 marks), 4 GS1/2/3 analytical (15), 3 GS4 concept (10), 1 essay paragraph (15). Fields as in batch 1.
3. Required fields. mcq: `id, batch, type, subject, topic, diff, q, opts[4], ans, why`. case: `id, batch, type:'case', subject:'Ethics', topic, diff, q, opts[4], score[4], why[4]`. mains: `id, batch, type:'mains', paper, topic, marks, words, q, dims, pts`. Ids must be globally unique (e.g. `p-11`, `c-09`, `e2-01`). Every fact (articles, cases, acts, figures) must be accurate; if unsure, drop the question and write another.
4. Avoid repeating a topic from earlier batches. Write plain, exam-realistic language.
5. Set `const IAS_ACTIVE = N+1;`. Keep older batches in the file (they are the history; do not delete).
6. Run `npm test` and fix anything in `test/ias.test.js` that fails (ids unique, 5-8 points, active batch >= 8 questions, 3+ papers).
7. Commit with message `Rotate questions to batch N+1` and tell the user the topics covered. Do not push unless asked.
