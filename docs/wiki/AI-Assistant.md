# AI metamodel assistant

The assistant is **optional** and off by default. It uses Google Gemini with your own API key
and helps with metamodels: it proposes types and relationships, and you review the proposal
before anything is added to the diagram.

## Turning it on

Set the key in the environment or in `.env`, then restart Symlit:

```bash
GEMINI_API_KEY=your-key
```

`GEMINI_MODEL` selects the model, or a comma-separated fallback list; without it a built-in
list is used.

## What leaves your machine

Without a key, Symlit makes no external requests. With a key, the assistant sends your
request and the metamodel context it needs to Google's Gemini API.
