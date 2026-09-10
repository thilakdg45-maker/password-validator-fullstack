# Secure Password Validator

A Theory of Computation micro-project for validating company portal passwords using a DFA-inspired state machine.

## Password policy

A password is accepted when:

- Length is at least 8 characters
- Contains an uppercase letter
- Contains a lowercase letter
- Contains a digit
- Contains only letters and digits

## Run

Open `index.html` in a modern browser.

No server or installation is required.

## TOC mapping

- Alphabet: uppercase letters, lowercase letters, digits
- Input string: user password
- States: track input length and required character categories
- Transition: process one character at a time
- Accepting state: `q8ULD`
- Dead state: `qDead`

## Next project step

Create the formal DFA in JFLAP and ensure its states/transitions match the state notation used by the website.
