# Claude Certified Architect – Foundations: Free Practice Exam (60 Questions)

A free, unofficial **Claude Certified Architect practice exam** for the Anthropic **Claude Certified Architect – Foundations** certification (exam code **CCAR-F**): 60 original single-answer questions across all six exam scenarios, each with an explanation. Take it as a CCA Foundations mock exam in the browser, read the [whole question bank in Markdown](questions/ccar-f.md), or download it as a PDF.

**About the format.** Anthropic's CCAR-F also uses multiple-response items and selects four of the six scenarios for each sitting; this practice exam does neither. The 120-minute timer is there to practise pacing. The score is this tool's own formula: it does not reproduce Anthropic's exam or its scoring.

> **Unofficial practice material.** This project is not affiliated with, endorsed by, or sponsored by Anthropic. All questions are original, written from the publicly available exam guide. See [Disclaimer](#disclaimer).

## Try it online

**▶ [Take the practice exam](https://szymonpaluch.com/claude-certified-architect-practice-exam)**: free, no account, runs in your browser.

Related reading:

- [Claude Certified Architect exam questions and answers](https://szymonpaluch.com/blog/posts/claude-certified-architect-practice-questions): three sample questions worked through, with the traps and study sources
- [Claude Certified Architect Foundations: my exam experience](https://szymonpaluch.com/blog/posts/claude-certified-architect-exam), the author's account of the exam day

## All four practice exams

The same engine runs a free practice exam for each Claude certification:

| Certification | Code | Questions | Practice exam |
|---|---|---|---|
| Claude Certified Associate – Foundations | CCAO-F | 60 | [Take it](https://szymonpaluch.com/claude-certified-associate-practice-exam) |
| Claude Certified Developer – Foundations | CCDV-F | 53 | [Take it](https://szymonpaluch.com/claude-certified-developer-practice-exam) |
| Claude Certified Architect – Foundations | CCAR-F | 60 | [Take it](https://szymonpaluch.com/claude-certified-architect-practice-exam) (this repo) |
| Claude Certified Architect – Professional | CCAR-P | 63 | [Take it](https://szymonpaluch.com/claude-certified-architect-professional-practice-exam) |

All four on one page: [Claude certification practice exams](https://szymonpaluch.com/claude-certification-practice-exams).

## The question bank

- **[questions/ccar-f.md](questions/ccar-f.md)**: all 60 questions grouped by domain, with the scenario, the options, the correct answer and its explanation. Answers are folded, so you can try each question first. Where an explanation names a wrong option by its letter, that sentence is shown as "Why B is wrong".
- **[PDF](https://szymonpaluch.com/downloads/claude-certified-architect-foundations-practice-questions.pdf)**: the same 60 questions with answers and explanations, no form to fill in.
- **Inside Claude**: the site runs a public MCP server that serves the same 60 questions one at a time in chat, with no signup or API key. [Setup for Claude and Claude Code](https://szymonpaluch.com/claude-certified-architect-practice-exam#mcp).

`questions/ccar-f.md` is generated from the JSON bank behind the online exam, so do not edit it by hand. To regenerate it:

```bash
node scripts/bank-to-markdown.mjs path/to/cca-mock-exam.json
```

The script needs Node.js and nothing else. It adds no text of its own to the explanations: it only splits each one into sentences and labels the sentences that name a wrong option.

## What's inside the app

- **60 original single-answer questions**, framed in production scenarios and spread across the five domains in proportion to their published weights.
- **Study mode**: pick an answer (switch freely), then hit **Check answer** to reveal the explanation. The timer pauses while you read.
- **Exam mode**: timed practice. No feedback until you submit, and the timer runs the whole time.
- **Score on a 100–1000 scale**, computed as `100 + 900 × (correct ÷ total)`, with 720 as a practice reference. It is not Anthropic's scoring method or a prediction of your result.
- **Per-domain breakdown**: see which of the five domains needs more work.
- **Review with explanations**: every question explains why the right answer is right and the distractors are wrong.
- **Resume anytime**: progress is saved in `localStorage`, so you can close the tab and pick up where you left off.

## Domains

| Domain | Name | Weight | Questions here |
|--------|------|--------|----------------|
| D1 | Agentic Architecture & Orchestration | 27% | 16 |
| D2 | Tool Design & MCP Integration | 18% | 11 |
| D3 | Claude Code Configuration & Workflows | 20% | 12 |
| D4 | Prompt Engineering & Structured Output | 20% | 12 |
| D5 | Context Management & Reliability | 15% | 9 |

## Run locally

No build step, no dependencies, no server:

```bash
git clone https://github.com/hculap/claude-certified-architect-practice-exam.git
cd claude-certified-architect-practice-exam
open index.html   # or just double-click it
```

Everything (questions, scoring, timer, UI) is a single self-contained HTML file. It makes zero network requests.

## Who made this

[Szymon Paluch](https://szymonpaluch.com), AI engineer and consultant. I wrote these questions while preparing for the exam, then passed it on 2026-07-15 with a scaled score of **833/1000** (pass mark: 720). The questions here are the ones I built to test myself, cleaned up and verified afterwards.

## Disclaimer

This is **unofficial practice material**. It is not affiliated with, endorsed by, or sponsored by Anthropic. All 60 questions are original work, written from the publicly available exam guide. They are not leaked, copied or reconstructed items from Anthropic's exam. Practising here does not guarantee any exam outcome. "Claude" is a trademark of Anthropic.

## License

[MIT](LICENSE) © 2026 Szymon Paluch
