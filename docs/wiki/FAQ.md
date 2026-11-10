# FAQ and troubleshooting

**Where is my data?**
In `./data/` next to the app (embedded database), or in the PostgreSQL database named by
`DATABASE_URL`. With Docker Compose it is in the `symlit-db` volume.

**The page says the host is not allowed.**
You opened Symlit under a host name other than `localhost` or an IP address. Add the name to
`SYMLIT_ALLOWED_HOSTS` and restart. See [Configuration](Configuration).

**Port 5000 is already in use.**
Start with another port: `PORT=5050 npm run dev`.

**Can several people work in one workspace?**
Not in the local edition. It is single-user and has no login. Accounts, team members and
share links are not part of this repository yet.

**A dialog says the diagram was changed elsewhere.**
The diagram was saved from another tab or through another diagram after you opened it. Choose
which version to keep; nothing is overwritten until you decide.

**A diagram does not open.**
The recovery dialog explains what is wrong and offers a repair. If that does not help, please
[open an issue](https://github.com/DHoffmannOVGU/Symlit/issues).

**How do I start from scratch?**
Stop Symlit and delete the `./data/` folder (embedded database). The demo project is created
again on the next start unless `SYMLIT_SEED_DEMO=false`.

**How do I enable the AI assistant?**
Set `GEMINI_API_KEY`. See [AI metamodel assistant](AI-Assistant).
