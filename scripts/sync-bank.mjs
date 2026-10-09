#!/usr/bin/env node
// Why this file exists: the question bank is maintained in the szymonpaluch.com repo
// (src/data/cca-mock-exam.json), where it drives the online exam, and it keeps changing there:
// explanations get rewritten, questions get fixed. This repo carries two copies of it, the
// Markdown bank (questions/ccar-f.md) and the data inside the app (window.EXAM_DATA in
// index.html). Copies edited by hand drift apart on the first such change, so both are written
// from the same JSON by this script, and --check fails when either no longer matches it.
//
// What it writes into the Markdown is the bank's own text plus fixed headings and labels. A
// "Why B is wrong" label appears only on a sentence of the explanation that names option B
// itself ("(B)", "option B", "B is wrong", or a sentence opening with a bare B); an explanation
// that names no option stays one paragraph. The sentences keep their original order.
//
// Usage:
//   node scripts/sync-bank.mjs <bank.json>            write questions/ccar-f.md and index.html
//   node scripts/sync-bank.mjs <bank.json> --check    write nothing; exit 1 if either file differs
// Options: --code=CCAR-F, --url=<exam page>, --md=<path> (default questions/<code>.md),
// --html=<path> (default index.html), --no-html (leave the app alone). No dependencies beyond node:*.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : true];
  }),
);
const [bankPath] = args.filter((a) => !a.startsWith('--'));
if (!bankPath) {
  console.error('usage: node scripts/sync-bank.mjs <bank.json> [--check] [--code=CCAR-F] [--url=<exam page>] [--md=<path>] [--html=<path>|--no-html]');
  process.exit(1);
}
const check = flags.check === true;
const code = flags.code || 'CCAR-F';
const examUrl = flags.url || 'https://szymonpaluch.com/claude-certified-architect-practice-exam';
const mdPath = flags.md || `questions/${code.toLowerCase()}.md`;
const htmlPath = flags['no-html'] ? null : flags.html || 'index.html';

const raw = readFileSync(bankPath);
const sha = createHash('sha256').update(raw).digest('hex');
const bank = JSON.parse(raw);

const LETTERS = 'ABCDEFGH';
const letter = (i) => LETTERS[i];

function fail(msgs) {
  for (const m of [].concat(msgs)) console.error(`sync-bank: ${m}`);
  process.exit(1);
}

// ── validation: refuse a bank that would render "undefined" or an empty question ──
const nonEmpty = (v) => typeof v === 'string' && v.trim() !== '';
function validate(b) {
  const errs = [];
  if (!Array.isArray(b.questions) || b.questions.length === 0) return ['the bank has no questions[]'];
  b.questions.forEach((q, i) => {
    const at = `question ${i + 1}${nonEmpty(q?.id) ? ` (${q.id})` : ''}`;
    if (!q || typeof q !== 'object') return errs.push(`${at}: not an object`);
    if (!nonEmpty(q.stem)) errs.push(`${at}: stem is missing or empty`);
    if (!nonEmpty(q.explanation)) errs.push(`${at}: explanation is missing or empty`);
    if (q.domain === undefined || q.domain === null || String(q.domain).trim() === '') errs.push(`${at}: domain is missing`);
    const okOptions = Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= LETTERS.length && q.options.every(nonEmpty);
    if (!okOptions) errs.push(`${at}: options must be 2 to ${LETTERS.length} non-empty strings`);
    const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
    const n = Array.isArray(q.options) ? q.options.length : 0;
    const okAnswer = ans.length > 0 && ans.every((a) => Number.isInteger(a) && a >= 0 && a < n) && new Set(ans).size === ans.length
      && (!Array.isArray(q.answer) || (q.answer.length >= 2 && q.answer.length < n));
    if (!okAnswer) errs.push(`${at}: answer must be an option index, or an array of 2+ distinct indices (got ${JSON.stringify(q.answer)})`);
  });
  return errs;
}
const errors = validate(bank);
if (errors.length) fail(errors);
const questions = bank.questions;

// ── Markdown ──
// Escaping outside code spans. `~` matters most: GitHub turns a pair of single tildes
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

// Sentences before the first one that names a wrong option form the lead paragraph; every
// sentence from there on is a bullet, labelled only if it names a wrong option.
function renderExplanation(q, correct) {
  const tagged = sentences(q.explanation).map((s) => ({
    s,
    bare: /^[B-H]\s+\p{Ll}/u.test(s),
    wrong: [...namedLetters(s, q.options.length)].filter((l) => !correct.includes(l)).sort(),
  }));
  // A bare opening "A" is read as option A only inside an explanation that already opens other
  // sentences with bare B, C, D…, when A is a wrong option named nowhere else and the sentence
  // names no other option: "A builds a brittle…" next to "C is a prompt-only…".
  if (!correct.includes('A') && tagged.some((t) => t.bare) && !tagged.some((t) => t.wrong.includes('A'))) {
    for (const t of tagged) if (!t.wrong.length && /^A\s+\p{Ll}/u.test(t.s)) t.wrong = ['A'];
  }
  const first = tagged.findIndex((t) => t.wrong.length);
  const lead = first === -1 ? tagged : tagged.slice(0, first);
  const rest = first === -1 ? [] : tagged.slice(first);

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

function renderMarkdown() {
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
      const correct = (Array.isArray(q.answer) ? q.answer : [q.answer]).map(letter);
      body.push(`### Question ${n}`, '');
      if (nonEmpty(q.scenario)) body.push(`**Scenario:** ${md(q.scenario)}`, '');
      body.push(md(q.stem), '');
      if (correct.length > 1) body.push(`*Select ${correct.length}.*`, '');
      q.options.forEach((o, i) => body.push(`- **${letter(i)}.** ${md(o)}`));
      body.push('', '<details>', '<summary>Answer and explanation</summary>', '');
      body.push(`**Correct answer${correct.length > 1 ? 's' : ''}: ${correct.join(', ')}**`, '');
      const { lines, named } = renderExplanation(q, correct);
      if (named.size === q.options.length - correct.length) explained += 1;
      body.push(...lines, '</details>', '');
    }
  }

  const head = [
    `<!-- Generated by scripts/sync-bank.mjs from ${basename(bankPath)} (sha256 ${sha}). Do not edit by hand: change the bank and regenerate. -->`,
    '',
    `# ${md(bank.title || code)} practice questions (${code})`,
    '',
    nonEmpty(bank.note) ? noteToMarkdown(bank.note) : '',
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
  const text = `${[...head, ...body].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
  return { text, explained };
}

// ── index.html: the app reads the bank from one `window.EXAM_DATA = {…};` line ──
// Serialised with ", " and ": " separators, the format that line already uses, and with "</"
// and "<!--" escaped so no string in the bank can end the <script> element.
function pyJson(v) {
  if (Array.isArray(v)) return `[${v.map(pyJson).join(', ')}]`;
  if (v && typeof v === 'object') return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyJson(x)}`).join(', ')}}`;
  return JSON.stringify(v);
}
const DATA_LINE = /^window\.EXAM_DATA = .*;$/m;
function renderHtml(current) {
  const matches = current.match(new RegExp(DATA_LINE.source, 'gm')) || [];
  if (matches.length !== 1) fail(`${htmlPath}: expected exactly one "window.EXAM_DATA = …;" line, found ${matches.length}`);
  const data = pyJson(bank).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\u0021--');
  return current.replace(DATA_LINE, () => `window.EXAM_DATA = ${data};`);
}

// ── write or check ──
const outputs = [];
const { text: mdText, explained } = renderMarkdown();
outputs.push({ path: mdPath, text: mdText });
if (htmlPath) {
  if (!existsSync(htmlPath)) fail(`${htmlPath} not found (pass --no-html to skip the app)`);
  outputs.push({ path: htmlPath, text: renderHtml(readFileSync(htmlPath, 'utf8')) });
}

if (check) {
  const stale = outputs.filter((o) => !existsSync(o.path) || readFileSync(o.path, 'utf8') !== o.text).map((o) => o.path);
  if (stale.length) fail(`out of date with ${bankPath}: ${stale.join(', ')}. Run: node scripts/sync-bank.mjs ${bankPath}`);
  console.log(`sync-bank: ${outputs.map((o) => o.path).join(' and ')} match ${basename(bankPath)} (sha256 ${sha.slice(0, 12)})`);
} else {
  for (const o of outputs) {
    mkdirSync(dirname(o.path), { recursive: true });
    writeFileSync(o.path, o.text);
  }
  console.log(
    `sync-bank: ${questions.length} questions -> ${outputs.map((o) => o.path).join(', ')}; ${explained} explanations name every wrong option (sha256 ${sha.slice(0, 12)})`,
  );
}
