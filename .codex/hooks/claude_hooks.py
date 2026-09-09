#!/usr/bin/env python3
"""Run this project's existing Claude command hooks for Codex tool events."""

import json
import os
from pathlib import Path
import re
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[2]


def main():
    raw = sys.stdin.read()
    event = json.loads(raw)
    name = event.get('hook_event_name')
    tool = event.get('tool_name')
    if name not in ('PreToolUse', 'PostToolUse'):
        return 0

    if tool == 'Bash':
        inputs = [('Bash', raw)]
    elif name == 'PostToolUse' and tool == 'apply_patch':
        paths = {}
        cwd = ROOT / (event.get('cwd') or '')
        for line in event.get('tool_input', {}).get('command', '').splitlines():
            match = re.match(r'^\*\*\* (Add File|Update File|Move to): (.+)$', line)
            if match:
                path = (cwd / match[2]).resolve()
                if path.is_relative_to(ROOT) and path.is_file():
                    paths[path] = 'Write' if match[1] == 'Add File' else 'Edit'
        inputs = [
            (alias, json.dumps({
                **event,
                'tool_name': alias,
                'tool_input': {'file_path': str(path)},
            }))
            for path, alias in paths.items()
        ]
    else:
        return 0

    settings = json.loads((ROOT / '.claude/settings.json').read_text())
    env = {**os.environ, 'CLAUDE_PROJECT_DIR': str(ROOT)}
    failed = False
    for alias, payload in inputs:
        for group in settings.get('hooks', {}).get(name, []):
            matcher = group.get('matcher', '')
            if matcher not in ('', '*') and not re.fullmatch(matcher, alias):
                continue
            for hook in group.get('hooks', []):
                if hook.get('type') != 'command':
                    continue
                # Only trusted, checked-in Claude commands are shell-interpreted.
                result = subprocess.run(
                    hook['command'], shell=True, input=payload, text=True,
                    capture_output=True, cwd=ROOT, env=env,
                )
                if result.returncode:
                    sys.stderr.write(result.stdout + result.stderr)
                    failed = True
    return 2 if failed else 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, ValueError, TypeError) as error:
        print(f'Claude hook bridge failed: {error}', file=sys.stderr)
        sys.exit(2)
