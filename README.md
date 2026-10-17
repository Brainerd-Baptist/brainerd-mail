# Brainerd Mail

Newsletters and texts for Brainerd Baptist ministries. Replaces the Canva + ClearStream process.

- Email is built from blocks (see `lib/blocks.ts`) and rendered to email-safe HTML by `lib/render.ts`.
- Each ministry has an approved color profile (`lib/ministries.ts`). Layout, type and buttons never change.
- ClearStream owns who is subscribed and sends the texts. Brainerd Mail never touches Planning Center people.
- Every email goes to the approver before it sends (see the spec in the Brainerd HQ project).

## Run it

```
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000/editor
npm run test                 # renders the Missions email, checks size
```

Status: editor, preview and renderer work. Sign-in, database, test send, tracking, approval and analytics are next.
