<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->

I want you to always build the ui in self developed components under lib/components/*
So we build our own component library with a Color Palette to keep the UI consistent and minimal!

Do not start a new Dev environment, there is always one running!

Build the code in a solid structured way to keep improving and to easy add new features to the codebase. SO do NOT implement features just for this case to make them work. Implement them in an generic and modular way to make it easy to expand upon that!

Do NOT use `eyebrows` in the UI! 
Keep the style of the UI as the rest and pls only use the components in the components folder in the ui! 

So the hierachy is just like this:
1. User
2. Instance (These are the multiple Agents in the hero page)
3. Session (These are the multiple sessions in the detailed agent page)
4. Task (There are many task (knowledge graph) in a session)
5. Action (An Action is a node in the knowledge graph)