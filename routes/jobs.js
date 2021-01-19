"use strict";

/** Routes for jobs. */

const jsonschema = require("jsonschema");
const express = require("express");

const { BadRequestError } = require("../expressError");
const { ensureIsAdmin } = require("../middleware/auth");
const Job = require("../models/job");
const newJobSchema = require("../schemas/jobNew.json");
const updateJobSchema = require("../schemas/jobUpdate.json")

const router = new express.Router();

/** POST / { job } =>  { job }
 *
 * job data should be { title, salary, equity, companyHandle }, with salary and equity being optional.
 *
 * Returns { id, title, salary, equity, companyHandle }
 *
 * Authorization required: login as admin
 * 
 * Send your token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * in your request code like so - .set("authorization", `Bearer ${token}`)
 */

router.post("/", ensureIsAdmin, async (req, res, next) => {
  try {
    const validator = jsonschema.validate(req.body, newJobSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const job = await Job.create(req.body);
    return res.status(201).json({ job });
  } catch (err) {
    return next(err);
  }
});

/** GET /  =>
 *   { jobs: [ { id, title, salary, equity, companyHandle }, ...] }
 * 
 * Can also pass filters in - 'title' - a String, 'minSalary' - a Number, and 'hasEquity' - true or false as a String
 * 
 * Sorts by most recent job added.
 *
 * Authorization required: none
 * 
 */

router.get("/", async function (req, res, next) {
  try {
    const jobs = await Job.findAll(req.query);
    return res.json({ jobs });
  } catch (err) {
    return next(err);
  }
});

/** GET /[id]  =>  { job }
 *
 *  Company is { id, title, salary, equity, companyHandle }
 *
 * Authorization required: none
 */

router.get("/:id", async function (req, res, next) {
  try {
    const job = await Job.get(req.params.id);
    return res.json({ job });
  } catch (err) {
    return next(err);
  }
});

/** PATCH /[id] { fld1, fld2, ... } => { job }
 *
 * Patches job data.
 *
 * fields can be: { title, salary, equity }
 *
 * Returns { id, title, salary, equity, companyHandle }
 *
 * Authorization required: login as admin
 * 
 * Send token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * in your request code like so - .set("authorization", `Bearer ${token}`)
 */

router.patch("/:id", ensureIsAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, updateJobSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const job = await Job.update(req.params.id, req.body);
    return res.json({ job });
  } catch (err) {
    return next(err);
  }
});

/** DELETE /[id]  =>  { deleted: id }
 *
 * Authorization: login as admin
 * 
 * Send token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * in your request code like so - .set("authorization", `Bearer ${token}`)
 */

router.delete("/:id", ensureIsAdmin, async function (req, res, next) {
  try {
    await Job.remove(req.params.id);
    return res.json({ deleted: req.params.id });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;