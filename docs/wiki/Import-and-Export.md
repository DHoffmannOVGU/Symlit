# Import and export

## Export

- **JSON:** the whole project (elements, relationships, diagrams). This is the *project file*
  format; it is also what templates and Duplicate use.
- **CSV:** elements and relationships as tables, for spreadsheets.
- **Screenshot:** the current diagram as an image.

## Import

On the project list, **Import** opens a JSON export as a **new project**. Nothing existing is
overwritten.

## Moving a workspace

To move everything to another machine, either export and import the projects one by one, or
copy the database: the `./data/` folder for the embedded database, or a dump of your
PostgreSQL database.
