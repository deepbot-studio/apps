# Tutor: decisions

What this app is, and why it is built this way. For anybody reading the code.

## The shape of it

- **The Bot writes, the app teaches.** A course is `tutor/<slug>/course.json` plus `lessons/<id>.json` made of blocks; the Learn page, and the `showLesson` card in the chat, render them. Lessons are written as the learner goes, so the course page shows lessons not written yet with a button to ask for them.
- **Answers are checked in the app, not by the Bot**: a small maths language (no eval) reads what people type (2x, 1,5, √, x², sin x, 5!) and decides whether two expressions are the same by trying them at many points, with `form` for "factored"/"expanded" when the shape is the question. Nine question kinds, a hint after one miss, the answer after two, and exercises solved one checked step at a time.
- **Graphs** with a slider for every parameter, pan and zoom; **ten simulations** (projectile, pendulum, spring, waves, circuit, orbit, population growth, supply and demand, dice, fractions); formulas and chemistry with KaTeX (bundled, MIT).
- **Progress stays with the person** in the app's storage, not in the workspace: first-try scores, stars, points, a day streak, a 20-week activity map, flashcards on SM-2 (Again 10 min, Hard 6 h for a new card, Good, Easy).
- **Two looks**: calm and editorial (Fraunces and Lexend, a font made for reading) for teens and adults; round, bright, a path of stars, read-aloud and confetti for children.
- "Ask the tutor" from a page starts a conversation whose first line names the course and lesson file, so the Bot reads exactly that. On a DeepBot that keeps the conversation beside the page ("ask-beside") the same words go as instructions, so the chat shows the learner's own words.
- A lesson file with mistakes (an answer pointing at no option, an unknown simulation) shows what is wrong at the top, so the Bot can fix it.
- **Not yet**: drawing answers (geometry by hand), speech input for language learning, a parent's view of a child's progress.

## 1.2.0

- **Worked examples showed no steps on the Learn page**: the course menu's popover and the steps' arrival animation shared the class `pop`, so every revealed step became a fixed popover off screen, and closing a menu deleted them (and a review answer, and the ask box). The menu is `cmenu` now.
- **Two different scores**: the lesson's end said 25% right first time, the course 50%, because the course ignored skipped questions. Both count them now (the lesson's question count is kept with its progress).
- **"0 new flashcards"** at the end of a lesson whose cards were already added with "Add to my review": it says how many of the lesson's cards are in the review.
- A review card turns when it is tapped, not only with the button (as the lesson's flashcards do).
- The new-course placeholder no longer runs out of its box.
- **"Ask the tutor" stays on the page**: the conversation opens beside the course. New courses and lessons appear by themselves; a lesson the learner is waiting for ("not written yet") opens as soon as its file exists; an open lesson is never swapped under the learner: "The tutor changed this lesson. Show the new version".
- The lesson's footer keeps room under it for the "Ask the tutor" button.
