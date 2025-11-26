# Purpose

Build and manage local sandboxes (OrbStack/Tmux) to run code in isolation.

## Variables

USER_REQUEST: $1
BACKEND: $2 default "tmux" (or "orbstack" for full isolation)

## Workflow

1. Read and execute the `SKILL.md` file to validate we're ready to run in local sandboxes.
2. Execute on the `USER_REQUEST` using the sandbox skill to build the request end to end.
3. If the user request you to 'host' the application, be sure to use `get-host` to retrieve the public URL.
   1. Test the application from outside the sandbox with `curl <public url returned from get-host>` to validate the user's access to the application.
   2. Be sure to properly restart the server before presenting the public URL to the user.

## Report

Report execution results to the user. Show the sandbox ID and the URL if applicable.
