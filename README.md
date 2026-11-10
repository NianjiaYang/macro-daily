# Macro Daily

A daily market brief that teaches while it informs. Each brief explains what moved and why, defines every technical term in place, and ends with a short quiz.

## Just read it
Open https://nianjiayang.github.io/macro-daily/. No account or install needed.

## Learn with your own AI tutor
Load this folder into an AI coding assistant (Claude Code, Cursor, Codex, Gemini CLI or similar) and it becomes your personal tutor. It asks about your goals once, then each day it walks you through the brief, quizzes you and tracks what you have learned.

1. Download the folder:
```bash
git clone https://github.com/NianjiaYang/macro-daily.git
```
2. Open the `macro-daily` folder in your AI assistant.
3. Say: **start**

Each day, open the folder again and say **start**. The assistant fetches the new brief for you.

Other things you can say: `quiz me`, `explain <term>`, `weekly quiz`, `my progress`, `change my focus`, `catch me up`.

## Your progress is private
Your profile and progress are saved in a `me/` folder on your own computer. That folder is never uploaded; git is set to ignore it. To move to another computer, copy the `me/` folder across.

## See your progress map
Run this in the folder, then open http://localhost:8000 and click **My progress**:
```bash
python3 -m http.server 8000
```

## About the content
Briefs are written by an AI model from free public sources and official data, then checked number by number. Corrections are noted on the brief. This is for learning and is not investment advice.
