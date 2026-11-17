# Import and export

## Export

- **JSON:** the whole project (elements, relationships, diagrams). This is the *project file*
  format; it is also what templates and Duplicate use.
- **CSV:** elements and relationships as tables, for spreadsheets.
- **Screenshot:** the current diagram as an image.

## Import

On the project list, **Import** opens a JSON export as a **new project**. Nothing existing is
overwritten. A project whose name is taken already, by the project the file was exported from for
example, is marked **(imported)** so that the two can be told apart.

A model can only be opened together with the metamodels it uses. For a file that someone else
will import, tick **Referenced metamodel definitions** in the export dialog: the file then
brings the metamodels along, and importing creates them as new projects next to the model.

## Moving a workspace

To move everything to another machine, either export and import the projects one by one, or
copy the database: the `./data/` folder for the embedded database, or a dump of your
PostgreSQL database.
