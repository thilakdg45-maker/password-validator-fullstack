# Secure Password Validator — Frontend + Backend + JFLAP

This version connects the Company Portal frontend to a Node.js backend.

## Architecture

Browser → `POST /api/validate` → Node.js backend → JFLAP DFA transitions → JSON result → Browser

The backend loads `dfa/password_validator_9_state_Final.jff` and applies its transitions. The website classifies real characters internally as:

- `U` = uppercase letter
- `L` = lowercase letter
- `D` = digit
- `X` = invalid character

The user never has to type U/L/D.

## Current DFA policy

The uploaded 9-state DFA accepts strings of at least 8 characters using U/L/D. `q8` is the accepting state. Invalid characters are rejected by the application as `qDead`.

## Run

1. Install Node.js if it is not already installed.
2. Open this folder in VS Code.
3. Run `node server.js`.
4. Open `http://localhost:3000`.

No npm packages are required.
