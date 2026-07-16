' hidden-hook.vbs — Windowless launcher for Claude Code hooks on Windows.
'
' Workaround for anthropics/claude-code#14828 / #70200 — Claude Code's
' child_process.spawn for hook commands is missing windowsHide/CREATE_NO_WINDOW,
' so every hook fire flashes a visible cmd.exe window. This shim is invoked via
' wscript.exe (a GUI-subsystem host with no console), so Claude Code's outer
' spawn attaches no console. Internally it runs node hidden via
' WScript.Shell.Run(cmd, 0, True).
'
' Usage from settings.local.json:
'   "command": "wscript.exe \"${CLAUDE_PROJECT_DIR}\\.claude\\helpers\\hidden-hook.vbs\" hook-handler.cjs pre-bash"
'
' TRADE-OFF: wscript.exe has no stdin. Claude Code sends hook event data as
' JSON via stdin, so hooks routed through this shim run WITHOUT their event
' payload. Most ruflo hooks (env-var driven) still work; hooks like `route`
' that need the user's prompt will have reduced context.
'
' Exit code from the wrapped node process is propagated back to Claude Code.

Option Explicit

If WScript.Arguments.Count < 1 Then
    WScript.Quit 2
End If

Dim shell, cmd, i, arg
Set shell = CreateObject("WScript.Shell")

' Resolve helpers dir from this script's own path (avoids env-var dependency)
Dim scriptDir
scriptDir = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))

' First arg is the hook-handler script name (e.g. "hook-handler.cjs"),
' remaining args are passed through to node.
cmd = "node """ & scriptDir & WScript.Arguments(0) & """"
For i = 1 To WScript.Arguments.Count - 1
    arg = WScript.Arguments(i)
    arg = Replace(arg, """", "\""")
    cmd = cmd & " """ & arg & """"
Next

' 0 = SW_HIDE, True = wait for completion (propagates exit code synchronously)
WScript.Quit shell.Run(cmd, 0, True)
