# ROOP Language Reference

ROOP (Robot Orchestration and Operations Programming) is a domain-specific language for coordinating robots and smart devices. This document summarises the syntax, semantics, and runtime expectations for ROOP.

## 1. Program structure

A ROOP source file (`.roop`) consists of directives and task definitions. Tasks are declared with `start task` and terminated with `end task`.

```roop
start task "Example":
  say "Hello"
end task
```

### 1.1 Directives

- `import "path"` – include an external library
- `include "path"` – embed another ROOP file
- `pragma key value` – provide compiler/runtime hints

## 2. Blocks & control flow

Block headers end with a colon (`:`) and increase the indentation level:

- `when`, `on`, `at`
- `if`, `elseif`, `else`
- `repeat`, `while`, `for`
- `parallel`
- `template task`

`end task` reduces the indentation level.

### 2.1 Conditionals

```roop
if battery.level < 30:
  notify "Charge soon"
else:
  log "Battery ok"
```

### 2.2 Loops

```roop
repeat 3 times:
  move Arm1 to "Inspect"
```

## 3. Actions

Actions describe work for the runtime to execute. Each action begins with a verb and optional parameters.

```roop
move Arm1 to "Home"
grasp with Gripper1
release with Gripper1
navigate to "Dock"
```

Verbs resolve to module capabilities or built-in handlers. Extend the verb catalog via module manifests or user settings (`roop.verbs`).

## 4. Triggers & events

Use triggers to react to time and sensor events:

```roop
every 10s:
  detect object "cup" near "Table"
```

Use `on failure`, `on timeout`, and `fallback` to handle exceptional flows.

## 5. Templates

Templates package reusable task logic:

```roop
template task "PickAndPlace"(arm, gripper, source, target):
  move ${arm} to ${source}
  grasp with ${gripper}
  move ${arm} to ${target}
  release with ${gripper}
```

Invoke templates with `run "PickAndPlace"(Arm1, Gripper1, fromPose, toPose)`.

## 6. Modules & manifests

Modules declare capabilities in `.roopmodule.json` files. Each capability maps a verb to one or more transports, data contracts, and safety rules. The extension validates manifests against `schemas/roopmodule.schema.json`.

## 7. Formatting guidelines

- Use two spaces per indent level.
- Keep block headers on their own line ending with a colon.
- Place `end task` at the same indentation level as the matching `start task`.

## 8. Grammar summary (EBNF)

```
program        ::= (directive | task | template)*
directive      ::= 'import' string | 'include' string | 'pragma' identifier (identifier | string)?
task           ::= 'start' 'task' string ':' NEWLINE block 'end' 'task'
template       ::= 'template' 'task' string '(' paramList? ')' ':' NEWLINE block
block          ::= statement*
statement      ::= action | assignment | ifBlock | loop | eventBlock | parallelBlock | subtask | exceptionBlock
ifBlock        ::= 'if' expression ':' block ('elseif' expression ':' block)* ('else' ':' block)?
loop           ::= 'repeat' number 'times' ':' block | 'while' expression ':' block | 'for' identifier 'in' expression ':' block
eventBlock     ::= 'when' expression ':' block | 'on' identifier expression? ':' block | 'at' 'time' string ':' block
parallelBlock  ::= 'parallel' ':' block
```

## 9. Example

```roop
start task "KitchenCleanup":
  when sensor "sink" is empty:
    parallel:
      move Arm1 to "DishRack"
      move Arm2 to "Pantry"
  on failure:
    notify "Cleanup failed"
end task
```

For further examples, see the files in the `examples/` directory.
