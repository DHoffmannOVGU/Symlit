import type { Express, NextFunction, Response } from "express";
import { z } from "zod";
import { api } from "@shared/routes";
import { createPattern, instantiatePattern, listPatterns } from "../services/patterns";

export function registerPatternRoutes(app: Express) {
  app.get(api.patterns.list.path, async (req, res, next: NextFunction) => {
    try {
      res.json(await listPatterns(Number(req.params.projectId)));
    } catch (err) {
      next(err);
    }
  });

  app.post(api.patterns.create.path, async (req, res) => {
    try {
      const input = api.patterns.create.input.parse(req.body);
      await createPattern(Number(req.params.projectId), input);
      res.status(201).json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        fail(err, res);
      }
    }
  });

  app.post(api.flow.instantiatePattern.path, async (req, res) => {
    try {
      const input = api.flow.instantiatePattern.input.parse(req.body);
      res.json(
        await instantiatePattern(
          Number(req.params.viewId),
          Number(req.params.patternId),
          input.position,
        ),
      );
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        fail(err, res);
      }
    }
  });
}

/** Express 4 does not catch errors thrown by async handlers; answer them here. */
function fail(err: unknown, res: Response) {
  const status = (err as { status?: number }).status;
  if (status && status < 500) {
    res.status(status).json({ message: (err as Error).message });
  } else {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
