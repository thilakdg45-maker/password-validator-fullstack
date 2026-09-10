# Secure Password Validator

A company portal password validation system built using a **Deterministic Finite Automaton (DFA)** with a Node.js backend and web frontend.

## Project Overview

This project demonstrates how a DFA can be used to validate password requirements.

The system checks whether a password satisfies the company's security policy:

- At least 8 characters
- At least 1 uppercase letter (A–Z)
- At least 1 lowercase letter (a–z)
- At least 1 digit (0–9)
- Only letters and digits are allowed

The DFA tracks whether uppercase letters, lowercase letters, and digits have appeared in the password. The minimum length requirement is additionally checked by the backend.

## DFA Design

The DFA uses the following input symbols:

- `U` = Uppercase letter (A–Z)
- `L` = Lowercase letter (a–z)
- `D` = Digit (0–9)

The DFA contains 8 states:

| State | Meaning |
|---|---|
| q0 | No required character category seen |
| qU | Uppercase seen |
| qL | Lowercase seen |
| qD | Digit seen |
| qUL | Uppercase + lowercase seen |
| qUD | Uppercase + digit seen |
| qLD | Lowercase + digit seen |
| qULD | Uppercase + lowercase + digit seen |

`q0` is the initial state.

`qULD` is the accepting state.

A password is accepted only when:

1. The DFA reaches `qULD`
2. The password contains at least 8 characters
3. Every character is a letter or digit

## System Architecture

```text
User
  |
  v
Web Interface
  |
  | POST /api/validate
  v
Node.js Backend
  |
  v
Password Character Classification
  |
  +--> U = Uppercase
  +--> L = Lowercase
  +--> D = Digit
  +--> X = Invalid character
  |
  v
JFLAP DFA
  |
  v
Validation Result + State Trace
  |
  v
Web Interface