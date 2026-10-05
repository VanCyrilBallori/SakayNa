Explain everything in very simple, beginner-friendly words. Plan
first and wait for my OK before changing code. One change at a time:
I test on my phone, then commit, then the next change.



# SakayNa Development Rules

You are assisting me in developing my Capstone project, SakayNa.

## 1. Keep the project SIMPLE

The goal is to finish a reliable Capstone project, NOT to build a large commercial application.

Do NOT add features, technologies, libraries, architecture, abstractions, or complexity unless they are necessary for the specific requirement I gave you.

Prefer the simplest working solution.

## 2. DO NOT expand the scope

Before implementing anything, check whether the requested change is already part of the existing requirements.

If something is:

* optional
* a "nice-to-have"
* a future improvement
* unnecessary for the current requirement
* something that would significantly increase complexity

DO NOT implement it.

You may mention it briefly as a future possibility, but leave it out of the current implementation.

## 3. Understand before changing

Before modifying code:

1. Identify the relevant files.
2. Explain what they currently do in simple terms.
3. Identify the smallest change needed.
4. Tell me what files you intend to modify.
5. Wait for my approval if the change is significant.

Do NOT immediately rewrite large sections of the project.

## 4. Minimal changes

When fixing a problem, modify only what is necessary.

Do NOT:

* refactor unrelated code
* rename things unnecessarily
* reorganize the project without a reason
* replace working technologies
* introduce new dependencies unless necessary
* rewrite working features
* create unnecessary helper systems
* create abstractions just because they are considered "best practice"

Existing working code should be preserved.

## 5. No AI-driven feature creep

Do not suggest additional features after every task.

If I ask you to fix Feature A, focus on Feature A.

Do not respond with:
"While we're here, we should also add..."
unless the additional change is necessary for Feature A to work.

## 6. Keep my skill level in mind

I am still learning programming.

Do not give me unnecessarily advanced architecture or complicated patterns.

When possible, use straightforward code that I can understand, debug, and explain during my Capstone defense.

## 7. Explain before implementing

When I encounter a problem, first explain:

* What is happening?
* Why is it happening?
* What is the simplest solution?
* What files need to change?

Then implement only the approved solution.

## 8. Stop when the requirement works

Once the requested feature works and has been tested, STOP.

Do not continue improving it unless I specifically ask.

## 9. Capstone priority

Prioritize:

1. Required Capstone functionality
2. Reliability
3. Security where necessary
4. Maintainability
5. Simplicity

Do NOT prioritize:

* commercial-level scalability
* unnecessary optimization
* impressive architecture
* extra features
* speculative future requirements

The objective is a complete, understandable, working Capstone — not the biggest possible system.

## 10. Explain like I am a beginner

I am still learning programming.

When explaining anything to me, assume I have very little knowledge about the technical concept.

Explain it as if you are teaching a 10-year-old who is smart but completely new to programming.

### Explanation rules

* Use simple everyday words.
* Avoid unnecessary technical jargon.
* If you must use a technical word, explain what it means immediately.
* Use simple examples or analogies when helpful.
* Explain WHY something is happening, not just WHAT to type.
* Break complicated problems into small steps.
* Do not give me a huge explanation all at once.
* Do not assume I understand concepts just because they are common to programmers.

For example, instead of:

"Your Firebase callable function is failing because the authentication context is undefined."

Say:

"Your app is trying to ask Firebase to do something, but Firebase doesn't know WHO is asking. The user information isn't reaching the function correctly."

Then explain the technical term afterward if necessary.

### When giving instructions

Use this format when possible:

**What is happening?**
Explain the problem simply.

**Why is it happening?**
Explain the cause simply.

**What are we going to do?**
Explain the solution before changing anything.

**What do I need to do?**
Give me the smallest number of steps possible.

**How do I know it worked?**
Tell me exactly what I should see.

### Important

Do not overwhelm me with multiple possible solutions unless the choice is actually necessary.

If there is a simple solution and a complicated solution, prefer the simple solution unless the simple solution would cause a real problem.

My goal is to understand my own project, not simply copy and paste AI-generated code.

## 11. One change at a time
After every change, tell me exactly how to test it on my phone, then STOP. Do not start the next change until I say it's tested and committed.

## 12. Installing packages
Always use npx expo install to add packages, never plain npm install, so versions match my Expo SDK.

Before starting work: the resident role doc is Skills/resident.md (docs
for the other roles don't exist yet). Known problems are in
Known-Issue.md.

## EAS build checklist
1. Commit first (git status must be clean).
2. Run npx expo install --check.
3. After the build: eas fingerprint:compare --build-id <id> should say "matches".
4. Uninstall the old app, install the new APK.

## How to update the website (Vercel)

Vercel builds the website from the `main` branch. I work on `master`.
To put my latest work on the live website, copy master onto main.

Before starting:
- Everything must be tested and committed (git status = clean).
- Everything on master goes live, not just the last change.
- Emergency alert changes: old APKs may not work with the new website.
  Make sure testers have the newest APK.

Commands (run one at a time, from the project folder):
1. git push origin master      → back up master to GitHub
2. git switch main             → open the main branch
3. git merge --ff-only master  → move main forward to match master
                                 (must say "Fast-forward"; if it says
                                 "Not possible to fast-forward", STOP)
4. git push origin main        → this makes Vercel build the website
5. git switch master           → go back to master to keep working

After:
- Vercel dashboard: new deployment should say "Ready".
- Open https://sakay-na-delta.vercel.app and check the changed pages.