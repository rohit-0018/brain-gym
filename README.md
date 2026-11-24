# Brain Gym

A daily, local-first brain workout. About 10 minutes, no accounts, no dependencies, no tracking. Your data stays in your browser.

**Live:** https://rohit-0018.github.io/brain-gym/

## Pages
- **Today**: a fixed session (breathing, technique of the day, spot the technique, n-back, Stroop, mental math). Press start; it runs them back to back. Any 3 keep your streak.
- **Practice**: pick one or more categories (Influence, Memory, Focus, Speed, Learning, Habits, Calm) and run everything in them.
- **Report**: streak, weekly activity, per-exercise trend with sparklines, accuracy per manipulation technique, and the situations you missed.
- **Coach**: patterns in your answers (what you confuse, whether you over-trust or over-suspect, how thin your explanations are, how consistent you are), and an optional AI coach that explains what you got wrong. See below.
- **Flashcards**: spaced repetition (SM-2 style), with CSV export/import.
- **Library**: all 18 techniques, your own saved examples, and the research behind each exercise, including what it does not show.

## Influence and manipulation (defensive)
18 techniques (Cialdini's principles, door-in-the-face, anchoring, gaslighting, DARVO, love bombing, guilt-tripping, triangulation, intermittent reinforcement, stonewalling, false dilemma, moving the goalposts, strawman) and 78 situations in two difficulty levels, plus fair requests as negative controls.
- Each day: one technique lesson, then 3 situations. You pick the technique (or "fair, no manipulation here") and write your reasoning.
- Scoring: right technique earns 60, plus up to 40 for the signals you named. A wrong technique earns at most 15.
- The first situation is yesterday's technique (a delayed recall, not a giveaway). Then come the ones you miss most. Harder situations unlock after 9+ answers at 65%+ accuracy.
- Format follows the prebunking research (Roozenbeek et al., 2022, Science Advances): name the pattern, show it in context, practise spotting it.

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
