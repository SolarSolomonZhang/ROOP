import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ACTION_REGEX = /^(\w[\w\s-]*)(?:\s+(.+))?$/i;

export async function executeTaskSequence(program, options = {}) {
  const { tasks } = program;
  const results = [];
  for (const task of tasks) {
    if (options.task && task.name !== options.task) {
      continue;
    }
    const result = await executeTask(task, options);
    results.push(result);
    if (options.task && task.name === options.task) {
      break;
    }
  }
  return results;
}

async function executeTask(task, options) {
  const transcript = [];
  const context = createExecutionContext(options);

  for (const statement of task.body) {
    const action = parseAction(statement.text);
    if (!action) {
      transcript.push({
        line: statement.line,
        statement: statement.text,
        outcome: 'ignored',
        detail: 'Unrecognised or empty action',
      });
      continue;
    }

    const outcome = await performAction(action, context, options);
    transcript.push({
      line: statement.line,
      statement: statement.text,
      outcome: outcome.status,
      detail: outcome.detail,
    });
  }

  return {
    task: task.name,
    startedAt: new Date().toISOString(),
    transcript,
  };
}

function parseAction(text) {
  const match = text.match(ACTION_REGEX);
  if (!match) {
    return null;
  }
  const verb = match[1].toLowerCase().trim();
  const rest = match[2]?.trim() ?? '';
  return { verb, rest, raw: text };
}

async function performAction(action, context, options) {
  const { verb, rest } = action;
  const log = context.log;

  switch (verb) {
    case 'say': {
      const message = extractQuoted(rest) ?? rest;
      log(`🤖 ${message}`);
      return { status: 'ok', detail: `Said: ${message}` };
    }
    case 'move': {
      log(`🚚 Moving ${rest}`);
      return { status: 'ok', detail: `Move ${rest}` };
    }
    case 'wait': {
      const duration = parseFloat(rest) || 1;
      log(`⏳ Waiting ${duration}s`);
      await delay(duration * 1000);
      return { status: 'ok', detail: `Waited ${duration}s` };
    }
    case 'ask': {
      const question = extractQuoted(rest) ?? rest;
      const answer = await prompt(question, options);
      return { status: 'ok', detail: `User answered: ${answer}` };
    }
    case 'log': {
      log(`📝 ${rest}`);
      return { status: 'ok', detail: `Logged: ${rest}` };
    }
    default: {
      log(`ℹ️  ${action.raw}`);
      return { status: 'ok', detail: `Recorded: ${action.raw}` };
    }
  }
}

function extractQuoted(text) {
  const match = text.match(/"([^"]*)"/);
  return match ? match[1] : null;
}

function createExecutionContext(options) {
  const logs = [];
  const log = (message) => {
    logs.push(message);
    if (!options.quiet) {
      output.write(`${message}\n`);
    }
  };
  return { logs, log };
}

async function prompt(question, options) {
  if (options.nonInteractive) {
    return '';
  }
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(`${question} `);
    return answer;
  } finally {
    rl.close();
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
