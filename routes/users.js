"use strict";

/** Routes for users. */

const jsonschema = require("jsonschema");

const express = require("express");
const { ensureLoggedIn, ensureIsAdmin, ensureIsAuthorized } = require("../middleware/auth");
const { BadRequestError } = require("../expressError");
const User = require("../models/user");
const { createToken } = require("../helpers/tokens");
const userNewSchema = require("../schemas/userNew.json");
const userUpdateSchema = require("../schemas/userUpdate.json");

const router = express.Router();


/** POST / { user }  => { user, token }
 *
 * Adds a new user. This is not the registration endpoint --- instead, this is
 * only for admin users to add new users. The new user being added can be an
 * admin.
 *
 * This returns the newly created user and an authentication token for them:
 *  {user: { username, firstName, lastName, email, isAdmin }, token }
 *
 * Authorization required: login as admin
 * 
 * Send your token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * to your request code like so - .set("authorization", `Bearer ${token}`)
 **/

router.post("/", ensureIsAdmin, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, userNewSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const user = await User.register(req.body);
    const token = createToken(user);
    return res.status(201).json({ user, token });
  } catch (err) {
    return next(err);
  }
});


/** GET / => { users: [ {username, firstName, lastName, email }, ... ] }
 *
 * Returns list of all users.
 *
 * Authorization required: login as admin
 * 
 * Send your token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * to your request code like so - .set("authorization", `Bearer ${token}`)
 **/

router.get("/", ensureIsAdmin, async function (req, res, next) {
  try {
    const users = await User.findAll();
    return res.json({ users });
  } catch (err) {
    return next(err);
  }
});


/** GET /[username] => { user }
 *
 * Returns { username, firstName, lastName, isAdmin }
 *
 * Authorization required: login as user being viewed or as admin
 * 
 * Send your token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * to your request code like so - .set("authorization", `Bearer ${token}`)
 **/

router.get("/:username", ensureIsAuthorized, async function (req, res, next) {
  try {
    const user = await User.get(req.params.username);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});


/** PATCH /[username] { user } => { user }
 *
 * Data can include:
 *   { firstName, lastName, password, email }
 *
 * Returns { username, firstName, lastName, email, isAdmin }
 *
 * Authorization required: login as user being updated or as admin
 * 
 * Send your token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * to your request code like so - .set("authorization", `Bearer ${token}`)
 **/

router.patch("/:username", ensureIsAuthorized, async function (req, res, next) {
  try {
    const validator = jsonschema.validate(req.body, userUpdateSchema);
    if (!validator.valid) {
      const errs = validator.errors.map(e => e.stack);
      throw new BadRequestError(errs);
    }

    const user = await User.update(req.params.username, req.body);
    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});


/** DELETE /[username]  =>  { deleted: username }
 *
 * Authorization required: login as user being deleted or as admin
 * 
 * Send your token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * to your request code like so - .set("authorization", `Bearer ${token}`)
 **/

router.delete("/:username", ensureIsAuthorized, async function (req, res, next) {
  try {
    await User.remove(req.params.username);
    return res.json({ deleted: req.params.username });
  } catch (err) {
    return next(err);
  }
});

/** POST /users/:username/jobs/:id  =>  { applied: jobId } 
 * 
 * Authorization required: login as user applying or as admin
 * 
 * Send your token in request header as 'authorization: Bearer <token>' with Insomnia or in JS chaining the .set method
 * to your request code like so - .set("authorization", `Bearer ${token}`)
*/

router.post("/:username/jobs/:id", ensureIsAuthorized, async (req, res, next) => {
  try {
    await User.apply(req.params.username, req.params.id);
    return res.json({ applied: parseInt(req.params.id) });
  } catch(err) {
    // if a user tries to apply to the same job twice, postgres will throw a unique constraint error with a code of '23505'
    // we can use that code to send our users a more user-friendly error message
    if (err.code === '23505') {
      return next(new BadRequestError("Can't apply to the same job twice"));
    }

    return next(err);
  }
});

module.exports = router;
