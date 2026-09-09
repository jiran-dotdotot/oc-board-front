"""Run with: python3 .codex/hooks/test_claude_hooks.py"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest


class ClaudeHooksTest(unittest.TestCase):
    def test_existing_hooks_through_codex_events(self):
        source = Path(__file__).resolve().parents[2]
        self.assertIsNotNone(shutil.which('jq'), 'Existing Claude hooks require jq')
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve() / 'project with spaces'
            bridge = root / '.codex/hooks/claude_hooks.py'
            bridge.parent.mkdir(parents=True)
            shutil.copy2(source / '.codex/hooks/claude_hooks.py', bridge)
            hooks = root / '.claude/hooks'
            hooks.mkdir(parents=True)
            shutil.copy2(source / '.claude/settings.json', root / '.claude/settings.json')
            for name in (
                'build-before-push', 'block-dev-server', 'format-on-edit',
                'check-commonjs', 'i18n-check', 'theme-token-check',
            ):
                shutil.copy2(source / f'.claude/hooks/{name}.sh', hooks)

            binaries = root / 'bin'
            binaries.mkdir()
            log = root / 'commands.log'
            for name in ('npx', 'npm'):
                executable = binaries / name
                executable.write_text(
                    '#!/bin/sh\n'
                    'printf "%s\\n" "$*" >> "$HOOK_TEST_LOG"\n'
                    + ('exit "${HOOK_TEST_BUILD_EXIT:-0}"\n' if name == 'npm' else '')
                )
                executable.chmod(0o755)
            env = {
                **os.environ, 'PATH': f'{binaries}{os.pathsep}{os.environ["PATH"]}',
                'HOOK_TEST_LOG': str(log), 'HOOK_TEST_BUILD_EXIT': '0',
                'TMUX': '', 'CONDUCTOR_WORKSPACE': '',
                'CLAUDE_PROJECT_DIR': '/must-be-overridden',
            }

            def run(name, tool, command, **context):
                return subprocess.run(
                    [sys.executable, str(bridge)],
                    input=json.dumps({
                        'hook_event_name': name, 'tool_name': tool,
                        'tool_input': {'command': command},
                        **context,
                    }),
                    text=True, capture_output=True, cwd=temporary, env=env,
                )

            blocked = run('PreToolUse', 'Bash', 'npm run dev')
            self.assertEqual(blocked.returncode, 2, blocked.stderr)
            self.assertIn('only inside tmux or Conductor', blocked.stderr)
            self.assertEqual(run('PreToolUse', 'Bash', 'npm run build').returncode, 0)
            self.assertFalse(log.exists())  # The intercepted command is never executed.
            env['HOOK_TEST_BUILD_EXIT'] = '1'
            failed_build = run('PreToolUse', 'Bash', 'git push origin develop')
            self.assertEqual(failed_build.returncode, 2)
            self.assertIn("'npm run build' failed", failed_build.stderr)
            env['HOOK_TEST_BUILD_EXIT'] = '0'
            self.assertEqual(run('PreToolUse', 'Bash', 'git push').returncode, 0)
            self.assertEqual(log.read_text().splitlines(), ['run build', 'run build'])
            log.unlink()

            files = {
                'src/plain $(touch injected).ts': 'export const value = 1\n',
                'src/common.ts': "const value = require('value')\n",
                'src/renamed file.ts': 'export const renamed = true\n',
                'src/deleted.ts': 'export const deleted = true\n',
                'src/locales/ko.json': '{"source-key": "원본"}',
                'src/locales/en.json': '{}',
                'src/locales/ja.json': '{}',
                'src/index.css': ':root {\n}\n.dark {\n  --orphan: red;\n}\n',
            }
            for relative, content in files.items():
                path = root / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content)
            outside = Path(temporary) / 'outside.ts'
            outside.write_text("module.exports = 'outside'\n")
            (root / 'src/link.ts').symlink_to(outside)
            patch = '\n'.join([
                '*** Begin Patch',
                '*** Add File: src/plain $(touch injected).ts',
                '*** Update File: src/common.ts',
                '*** Update File: src/old.ts',
                '*** Move to: src/renamed file.ts',
                '*** Delete File: src/deleted.ts',
                '*** Add File: src/missing.ts',
                '*** Add File: ../outside.ts',
                '*** Add File: src/link.ts',
                '*** Update File: src/locales/ko.json',
                '*** Update File: src/index.css',
                '*** Update File: src/common.ts',
                '*** End Patch',
            ])
            result = run('PostToolUse', 'apply_patch', patch)
            self.assertEqual(result.returncode, 2, result.stderr)
            self.assertIn('CommonJS', result.stderr)
            self.assertIn('en.json missing: source-key', result.stderr)
            self.assertIn('ja.json missing: source-key', result.stderr)
            self.assertIn('--orphan', result.stderr)
            self.assertFalse((root / 'injected').exists())
            self.assertEqual(log.read_text().splitlines(), [
                f'prettier --write {root / relative}' for relative in (
                    'src/plain $(touch injected).ts', 'src/common.ts',
                    'src/renamed file.ts', 'src/locales/ko.json', 'src/index.css',
                )
            ])
            from_subdirectory = run(
                'PostToolUse', 'apply_patch',
                '*** Begin Patch\n*** Update File: common.ts\n*** End Patch',
                cwd=str(root / 'src'),
            )
            self.assertEqual(from_subdirectory.returncode, 2)
            self.assertIn('CommonJS', from_subdirectory.stderr)
            self.assertEqual(
                log.read_text().splitlines()[-1], f'prettier --write {root / "src/common.ts"}'
            )

            (root / 'src/common.ts').write_text('export const value = 1\n')
            for language in ('en', 'ja'):
                (root / f'src/locales/{language}.json').write_text('{"source-key": "ok"}')
            (root / 'src/index.css').write_text(
                ':root {\n  --orphan: blue;\n}\n.dark {\n  --orphan: red;\n}\n'
            )
            repaired = run('PostToolUse', 'apply_patch', patch)
            self.assertEqual(repaired.returncode, 0, repaired.stderr)
            before = log.read_text()
            for name, tool in (
                ('PreToolUse', 'apply_patch'), ('PostToolUse', 'Read'),
                ('SessionStart', 'Bash'), ('PostToolUse', 'Bash'),
            ):
                self.assertEqual(run(name, tool, patch).returncode, 0)
            self.assertEqual(log.read_text(), before)


if __name__ == '__main__':
    unittest.main()
