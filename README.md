# Brain Gym

A daily, local-first brain workout. About 10 minutes, no accounts, no dependencies, no tracking. Your data stays in your browser.

**Live:** https://rohit-0018.github.io/brain-gym/

## Pages
- **Today**: a fixed session (breathing, technique of the day, spot the technique, n-back, Stroop, mental math). Press start; it runs them back to back. Any 3 keep your streak.
- **Practice**: pick one or more categories (Influence, Memory, Focus, Speed, Learning, Habits, Calm) and run everything in them.
- **Report**: streak, weekly activity, per-exercise trend with sparklines, accuracy per manipulation technique, and the situations you missed.
- **Flashcards**: spaced repetition (SM-2 style), with CSV export/import.
- **Library**: all 18 techniques, your own saved examples, and the research behind each exercise, including what it does not show.

## Influence and manipulation (defensive)
18 techniques (Cialdini's principles, door-in-the-face, anchoring, gaslighting, DARVO, love bombing, guilt-tripping, triangulation, intermittent reinforcement, stonewalling, false dilemma, moving the goalposts, strawman) and 78 situations in two difficulty levels, plus fair requests as negative controls.
- Each day: one technique lesson, then 3 situations. You pick the technique (or "fair, no manipulation here") and write your reasoning.
- Scoring: right technique earns 60, plus up to 40 for the signals you named. A wrong technique earns at most 15.
- The first situation is yesterday's technique (a delayed recall, not a giveaway). Then come the ones you miss most. Harder situations unlock after 9+ answers at 65%+ accuracy.
- Format follows the prebunking research (Roozenbeek et al., 2022, Science Advances): name the pattern, show it in context, practise spotting it.

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
