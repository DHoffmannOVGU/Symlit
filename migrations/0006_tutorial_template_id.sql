-- Both tutorial projects now come from one project template, "tutorial";
-- which is which follows from the project type.
UPDATE "projects" SET "template_id" = 'tutorial' WHERE "template_id" IN ('tutorial-metamodel', 'tutorial-instance');
