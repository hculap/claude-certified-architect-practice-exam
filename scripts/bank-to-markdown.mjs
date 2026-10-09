#!/usr/bin/env node
// Why this file exists: the question bank is maintained in the szymonpaluch.com repo
// (src/data/cca-mock-exam.json), where it drives the online exam, and it keeps changing there:
// explanations get rewritten, questions get fixed. A Markdown copy written by hand would drift
// on the first such edit, so questions/*.md is generated from the JSON and regenerated after
// every change to the bank.
//
// It never writes content of its own. Every sentence in the output comes from the bank; the
// script only orders, labels and escapes it. A "Why B is wrong" line appears only where the
// bank's explanation names option B itself, as "(B)", "option B" or "B is wrong"; an
// explanation that names no option stays one paragraph. The script checks that the sentences
// it printed join back into the original explanation and exits 1 if they do not.
//
// Usage:
//   node scripts/bank-to-markdown.mjs <bank.json> [out.md] [--code=CCAR-F] [--url=<exam page>]
// Defaults: --code=CCAR-F, --url=https://szymonpaluch.com/claude-certified-architect-practice-exam,
// out = questions/<code in lower case>.md. No dependencies beyond node:*.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.join('=')];
  }),
);
const [bankPath, outArg] = args.filter((a) => !a.startsWith('--'));
if (!bankPath) {
  console.error('usage: node scripts/bank-to-markdown.mjs <bank.json> [out.md] [--code=CCAR-F] [--url=<exam page>]');
  process.exit(1);
}
const code = flags.code || 'CCAR-F';
const examUrl = flags.url || 'https://szymonpaluch.com/claude-certified-architect-practice-exam';
const outPath = outArg || `questions/${code.toLowerCase()}.md`;

const raw = readFileSync(bankPath);
const sha = createHash('sha256').update(raw).digest('hex');
const bank = JSON.parse(raw);
const questions = bank.questions;
if (!Array.isArray(questions) || questions.length === 0) fail('the bank has no questions[]');

const LETTERS = 'ABCDEFGH';
const letter = (i) => LETTERS[i];

function fail(msg) {
  console.error(`bank-to-markdown: ${msg}`);
  process.exit(1);
}

// Markdown escaping outside code spans. `~` matters most: GitHub turns a pair of single tildes
// (two ~/.claude paths in one paragraph) into strikethrough, and a pair of `$` into math.
function md(text) {
  return String(text)
    .split(/(`[^`]*`)/)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/\\/g, '\\\\')
        .replace(/([*~$<>@[\]])/g, '\\$1')
        .replace(/(^|[^\p{L}\p{N}])_|_(?=$|[^\p{L}\p{N}])/gu, (m) => m.replace('_', '\\_'));
    })
    .join('');
}

// The bank's note is a short HTML string written for the exam page.
function noteToMarkdown(html) {
  const parts = String(html).split(/<(strong|b)>(.*?)<\/\1>/);
  let out = '';
  for (let i = 0; i < parts.length; i += 3) {
    out += md(parts[i].replace(/<[^>]+>/g, ''));
    if (parts[i + 2] !== undefined) out += `**${md(parts[i + 2])}**`;
  }
  return out;
}

const ABBREV = /(?:\b(?:vs|e\.g|i\.e|cf|approx|etc|Mr|Ms|Dr|St|No)\.)$/;
function sentences(text) {
  const pieces = String(text).trim().split(/(?<=[.!?]["'”’)]*)\s+/);
  const out = [];
  for (const p of pieces) {
    if (out.length && ABBREV.test(out[out.length - 1])) out[out.length - 1] += ` ${p}`;
    else out.push(p);
  }
  return out;
}

// Letters an explanation sentence names explicitly: "(B)", "(A, C)", "option B", "B is wrong",
// or a sentence that opens with a bare B, C, D… ("D confuses context size with…"). A sentence
// opening with a bare "A" is not read as option A, because "A larger window…" is the article:
// option A counts only in the explicit forms. "A classifier (D) is…" names D, not A.
function namedLetters(sentence, optionCount) {
  const valid = LETTERS.slice(0, optionCount);
  const list = `[${valid}](?:\\s*(?:,|and|or|&|\\/)\\s*[${valid}])*`;
  const found = new Set();
  const patterns = [
    new RegExp(`\\((?:[Oo]ptions?\\s+|[Cc]hoices?\\s+)?(${list})\\)`, 'g'),
    new RegExp(`\\b(?:[Oo]ptions?|[Cc]hoices?|[Aa]nswers?)\\s+(${list})\\b`, 'g'),
    new RegExp(`\\b(${list})\\s+(?:is|are)\\s+(?:wrong|incorrect)\\b`, 'g'),
    new RegExp(`^([${valid.slice(1)}])\\s+(?=\\p{Ll})`, 'gu'),
  ];
  for (const re of patterns) {
    for (const m of sentence.matchAll(re)) {
      for (const l of m[1].match(new RegExp(`[${valid}]`, 'g'))) found.add(l);
    }
  }
  return found;
}

function listLetters(ls) {
  if (ls.length === 1) return ls[0];
  return `${ls.slice(0, -1).join(', ')} and ${ls[ls.length - 1]}`;
}

function renderExplanation(q, correct) {
  const optionCount = q.options.length;
  const sents = sentences(q.explanation);
  const tagged = sents.map((s) => ({
    s,
    wrong: [...namedLetters(s, optionCount)].filter((l) => !correct.includes(l)).sort(),
  }));
  const first = tagged.findIndex((t) => t.wrong.length);
  const lead = first === -1 ? tagged : tagged.slice(0, first);
  const rest = first === -1 ? [] : tagged.slice(first);

  const printed = [...lead, ...rest].map((t) => t.s).join(' ');
  if (printed.replace(/\s+/g, ' ') !== String(q.explanation).trim().replace(/\s+/g, ' ')) {
    fail(`${q.id}: the printed sentences do not join back into the explanation`);
  }

  const lines = [];
  if (lead.length) lines.push(md(lead.map((t) => t.s).join(' ')), '');
  for (const t of rest) {
    if (!t.wrong.length) {
      lines.push(`- ${md(t.s)}`);
      continue;
    }
    const verb = t.wrong.length === 1 ? 'is' : 'are';
    lines.push(`- **Why ${listLetters(t.wrong)} ${verb} wrong:** ${md(t.s)}`);
  }
  if (rest.length) lines.push('');
  return { lines, named: new Set(rest.flatMap((t) => t.wrong)) };
}

function slug(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

const domains = bank.domains || {};
const domainIds = [...new Set(questions.map((q) => String(q.domain)))].sort((a, b) => Number(a) - Number(b));
const domainHeading = (d) => `D${d} · ${domains[d] || `Domain ${d}`}`;

let explained = 0;
const body = [];
for (const d of domainIds) {
  const inDomain = questions.map((q, i) => ({ q, n: i + 1 })).filter(({ q }) => String(q.domain) === d);
  body.push(`## ${domainHeading(d)}`, '');
  body.push(
    `${inDomain.length} questions. Answer them with a timer, scoring and a per-domain breakdown in the [interactive practice exam](${examUrl}).`,
    '',
  );
  for (const { q, n } of inDomain) {
    if (!Array.isArray(q.options) || q.options.length < 2) fail(`${q.id}: options missing`);
    const correct = (Array.isArray(q.answer) ? q.answer : [q.answer]).map((i) => {
      if (!Number.isInteger(i) || i < 0 || i >= q.options.length) fail(`${q.id}: answer ${i} is out of range`);
      return letter(i);
    });
    body.push(`### Question ${n}`, '');
    if (q.scenario) body.push(`**Scenario:** ${md(q.scenario)}`, '');
    body.push(md(q.stem), '');
    if (correct.length > 1) body.push(`*Select ${correct.length}.*`, '');
    q.options.forEach((o, i) => body.push(`- **${letter(i)}.** ${md(o)}`));
    body.push('', '<details>', '<summary>Answer and explanation</summary>', '');
    body.push(`**Correct answer${correct.length > 1 ? 's' : ''}: ${correct.join(', ')}**`, '');
    const { lines, named } = renderExplanation(q, correct);
    const wrongCount = q.options.length - correct.length;
    if (named.size === wrongCount) explained += 1;
    body.push(...lines, '</details>', '');
  }
}

const head = [
  `<!-- Generated by scripts/bank-to-markdown.mjs from ${basename(bankPath)} (sha256 ${sha}). Do not edit by hand: change the bank and regenerate. -->`,
  '',
  `# ${md(bank.title || code)} practice questions (${code})`,
  '',
  bank.note ? noteToMarkdown(bank.note) : '',
  '',
  'Unofficial practice material: not affiliated with, endorsed by, or sponsored by Anthropic. The questions are original.',
  '',
  `Take the same questions in the [interactive practice exam](${examUrl}), with study and timed modes, scoring and a per-domain breakdown. Each answer below is hidden in a collapsed block. Practice exams for the other Claude certifications: [all four exams](https://szymonpaluch.com/claude-certification-practice-exams).`,
  '',
  '## Domains',
  '',
  '| Domain | Questions |',
  '|---|---|',
  ...domainIds.map((d) => {
    const h = domainHeading(d);
    return `| [${md(h)}](#${slug(h)}) | ${questions.filter((q) => String(q.domain) === d).length} |`;
  }),
  '',
];

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${[...head, ...body].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`);
console.log(
  `bank-to-markdown: ${questions.length} questions -> ${outPath}; ${explained} explanations name every wrong option (sha256 ${sha.slice(0, 12)})`,
);
