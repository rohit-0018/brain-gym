# 🧠 Brain Gym

A local-first daily brain workout: ~20 minutes, 10 activities, one page. No accounts, no dependencies.

## Run
```bash
npm start        # → http://localhost:3000   (needs Node 18+)
```
Data is saved to **localStorage** (always) and to **`data/records.csv`** + **`data/cards.csv`** (when the server runs). CSVs are git-ignored so your personal data stays on your machine. You can also export/import CSV from the Progress tab.

## Daily session
| Activity | Trains | Based on |
|---|---|---|
| Box breathing | calm, attention | mindfulness research |
| Dual N-Back (adaptive) | working memory | Jaeggi et al. 2008 |
| Stroop | inhibition, focus | Stroop 1935, *Thinking, Fast and Slow* |
| Sequence memory | visual-spatial memory | Simon-style span tasks |
| Digit span (fwd/back) | short-term memory | classic neuropsych span test |
| Mental math sprint (adaptive) | processing speed | deliberate practice (*Peak*) |
| Memory palace | encoding & recall | *Moonwalking with Einstein* |
| Feynman journal | deep understanding | Feynman technique, *A Mind for Numbers* |
| Flashcards (SM-2 style) | long-term retention | *Make It Stick*, Ebbinghaus |
| Brain habits | sleep, exercise, reading, deep work | *Spark*, *Atomic Habits*, *Deep Work* |

Plus a daily curiosity challenge and a Library tab linking every exercise to its book/research.

**Honest note:** game-style training mostly improves the games themselves. The best-evidenced boosts to cognition are exercise, sleep, retrieval practice and learning new hard things — so the app blends all of them.

Streak = days with ≥3 activities completed.

## Ideas to extend
New games (Tower of Hanoi, word-chain, pattern logic), a weekly review, reminders, charts per game.
