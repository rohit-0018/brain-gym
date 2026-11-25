# Brain Gym

A daily, local-first brain workout. About 10 minutes, no accounts, no dependencies, no tracking. Your data stays in your browser.

**Live:** https://rohit-0018.github.io/brain-gym/

## Pages
- **Today**: a fixed session (breathing, UPSC practice, n-back, Stroop). Press start; it runs them back to back. Any 3 keep your streak.
- **Practice**: pick one or more categories (UPSC, Influence, Memory, Focus, Speed, Learning, Habits, Calm) and run everything in them.
- **Report**: streak, weekly activity, per-exercise trend with sparklines, accuracy by UPSC subject, the questions you missed, and accuracy per manipulation technique.
- **Coach**: patterns in your answers (what you confuse, whether you over-trust or over-suspect, how thin your explanations are, how consistent you are), and an optional AI coach that explains what you got wrong. See below.
- **Flashcards**: spaced repetition (SM-2 style), with CSV export/import.
- **Library**: all 18 techniques, your own saved examples, and the research behind each exercise, including what it does not show.

## UPSC practice
Eight tap-to-answer questions a day: 6 Prelims-style MCQs (many are "consider the following statements") and 2 Ethics case studies where you pick the best course of action from four. Every option is explained; case options carry a 0-100 score. "Mains answer writing" in Practice has written questions you self-mark against model points.
- **Question bank**: `public/ias-bank.js`. Types `mcq`, `case`, `mains`, grouped into numbered batches. Only the batch named by `IAS_ACTIVE` is served.
- **Rotating**: tell Claude Code "rotate questions". The `rotate-questions` skill (`.claude/skills/rotate-questions/SKILL.md`) writes a new batch of about 40, bumps `IAS_ACTIVE`, runs the tests and commits.
- **How questions are picked** (`pickSession` in `public/ias.js`, shown in the app too): active batch only; a missed question returns the next day, a correct one after 7+ days; never-seen before not-due; subjects spread out (each repeat of a subject costs 1.2 points); difficulty follows accuracy (under 55% easier, over 75% harder); nothing repeats on the same day; stable for the whole day. Each question shows a reason tag (New, You missed this last time, Revisit).
- Facts and explanations were written by an AI. Verify anything you plan to rely on for the real exam.

## Influence and manipulation (defensive)
18 techniques (Cialdini's principles, door-in-the-face, anchoring, gaslighting, DARVO, love bombing, guilt-tripping, triangulation, intermittent reinforcement, stonewalling, false dilemma, moving the goalposts, strawman) and 78 situations in two difficulty levels, plus fair requests as negative controls.
- In Practice > Influence: one technique lesson, then 3 situations. You pick the technique (or "fair, no manipulation here") and write your reasoning.
- Scoring: right technique earns 60, plus up to 40 for the signals you named. A wrong technique earns at most 15.
- The first situation is yesterday's technique (a delayed recall, not a giveaway). Then come the ones you miss most. Harder situations unlock after 9+ answers at 65%+ accuracy.
- Format follows the prebunking research (Roozenbeek et al., 2022, Science Advances): name the pattern, show it in context, practise spotting it.

## How the content was checked
An independent reviewer labelled all 78 situations blind (without seeing my labels, only the technique definitions): 78 of 78 matched. Ambiguous cases it flagged were rewritten. `npm test` also verifies every situation can earn full marks and that keys cannot be satisfied by filler.

## AI coach (optional, bring your own key)
Add an Anthropic or OpenAI key in the Coach tab to get: feedback on your reasoning after each situation, a weekly review, "what is holding me back?", and follow-up chat.
- The key is never in this repo. It is kept in `sessionStorage` (this tab only) unless you tick "Remember on this device".
- Requests go straight from your browser to the provider. No server of mine is involved.
- Sent: your computed summary, your recent missed situations and your own explanations. Never sent: journal entries, flashcards.
- A strict Content-Security-Policy lets the page contact only itself and `api.anthropic.com` / `api.openai.com`, and blocks inline scripts.
- Model names are editable if a provider retires one. Usage is billed to your own account.
- The coach is told to describe only what the data shows, to be honest about small samples, and to decline requests to manipulate people.
- Caveat: on GitHub Pages, every project site under the same `username.github.io` shares one browser storage origin, so do not tick "Remember" on a shared or untrusted device.

## Run locally
```bash
npm start      # http://localhost:3000, also writes data/records.csv and data/cards.csv (git-ignored)
npm test       # logic, content integrity and server tests
```
Or open `public/index.html` in a browser (or use the hosted site): progress is saved in localStorage. Use Report -> Download CSV to back it up.

## Honest note on the evidence
Brain-training games mostly improve the games. Meta-analyses of n-back training find task-specific gains and little transfer to everyday reasoning against active controls. Exercise, sleep, retrieval practice and learning hard new things are better supported, so the app blends those in.

## Layout
`public/logic.js` pure logic (scoring, trends, streaks, SM-2, CSV) shared by the app, server and tests · `public/manip.js` techniques and situations · `public/games.js` exercises · `public/app.js` views and storage · `server.js` optional local CSV server · `test/` node:test suite.
