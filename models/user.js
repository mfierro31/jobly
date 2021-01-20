"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { sqlForPartialUpdate } = require("../helpers/sql");
const {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
} = require("../expressError");

const { BCRYPT_WORK_FACTOR } = require("../config.js");

/** Related functions for users. */

class User {
  /** authenticate user with username, password.
   *
   * Returns { username, first_name, last_name, email, is_admin }
   *
   * Throws UnauthorizedError is user not found or wrong password.
   **/

  static async authenticate(username, password) {
    // try to find the user first
    const result = await db.query(
          `SELECT username,
                  password,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin"
           FROM users
           WHERE username = $1`,
        [username],
    );

    const user = result.rows[0];

    if (user) {
      // compare hashed password to a new hash from password
      const isValid = await bcrypt.compare(password, user.password);
      if (isValid === true) {
        delete user.password;
        return user;
      }
    }

    throw new UnauthorizedError("Invalid username/password");
  }

  /** Register user with data.
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws BadRequestError on duplicates.
   **/

  static async register(
      { username, password, firstName, lastName, email, isAdmin }) {
    const duplicateCheck = await db.query(
          `SELECT username
           FROM users
           WHERE username = $1`,
        [username],
    );

    if (duplicateCheck.rows[0]) {
      throw new BadRequestError(`Duplicate username: ${username}`);
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

    const result = await db.query(
          `INSERT INTO users
           (username,
            password,
            first_name,
            last_name,
            email,
            is_admin)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING username, first_name AS "firstName", last_name AS "lastName", email, is_admin AS "isAdmin"`,
        [
          username,
          hashedPassword,
          firstName,
          lastName,
          email,
          isAdmin,
        ],
    );

    const user = result.rows[0];

    return user;
  }

  /** Given a username and a job id, apply to a job. */

  static async apply(username, jobId) {
    // First, check to see if these 2 primary keys are valid
    let jobIdNum;

    if (isNaN(jobId)) {
      throw new BadRequestError("job 'id' param has to be a Number");
    } else {
      jobIdNum = parseInt(jobId);
    }

    const usrCheck = await db.query(`SELECT username FROM users WHERE username = $1`, [username]);
    const jobCheck = await db.query(`SELECT id FROM jobs WHERE id = $1`, [jobIdNum]);

    if (usrCheck.rows.length === 0) {
      throw new BadRequestError(`No user with username of: ${username}`);
    }

    if (jobCheck.rows.length === 0) {
      throw new BadRequestError(`No job with id of: ${jobIdNum}`);
    }

    await db.query(`INSERT INTO applications (username, job_id)
                    VALUES ($1, $2)`, [username, jobIdNum]);
  }

  /** Find all users.
   *
   * Returns [{ username, first_name, last_name, email, is_admin, jobs }, ...]
   *    where jobs is [ id, id, id, ...]
   **/

  static async findAll() {
    // To include all job ids, but still getting all users, even if they haven't applied for any jobs, we have to do a
    // LEFT JOIN on applications, so that all users are included.  

    // also important to note the position of GROUP BY in this query.  GROUP BY has to come right after the WHERE or FROM clause
    // or before an ORDER BY clause, else it gives an error
    const result = await db.query(
          `SELECT u.username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin",
                  array_agg(job_id) AS "jobs"
           FROM users AS u
              LEFT JOIN applications AS a ON u.username = a.username
           GROUP BY u.username
           ORDER BY u.username`);

    return result.rows;
  }

  /** Given a username, return data about user.
   *
   * Returns { username, first_name, last_name, is_admin, jobs }
   *   where jobs is [ id, id, id, ... ]
   *
   * Throws NotFoundError if user not found.
   **/

  static async get(username) {
    // Even though we're only getting 1 user back in this situation, we still have to use LEFT JOIN in our query, because if we
    // don't, if our user hasn't applied to any jobs, we won't get back anything from the database.  
    const userRes = await db.query(
          `SELECT u.username,
                  first_name AS "firstName",
                  last_name AS "lastName",
                  email,
                  is_admin AS "isAdmin",
                  array_agg(job_id) AS "jobs"
           FROM users AS u
              LEFT JOIN applications AS a ON u.username = a.username
           WHERE u.username = $1
           GROUP BY u.username`,
        [username],
    );

    const user = userRes.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    return user;
  }

  /** Update user data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include:
   *   { firstName, lastName, password, email, isAdmin }
   *
   * Returns { username, firstName, lastName, email, isAdmin }
   *
   * Throws NotFoundError if not found.
   *
   * WARNING: this function can set a new password or make a user an admin.
   * Callers of this function must be certain they have validated inputs to this
   * or a serious security risks are opened.
   */

  static async update(username, data) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, BCRYPT_WORK_FACTOR);
    }

    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          firstName: "first_name",
          lastName: "last_name",
          isAdmin: "is_admin",
        });
    const usernameVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE users 
                      SET ${setCols} 
                      WHERE username = ${usernameVarIdx} 
                      RETURNING username,
                                first_name AS "firstName",
                                last_name AS "lastName",
                                email,
                                is_admin AS "isAdmin"`;
    const result = await db.query(querySql, [...values, username]);
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);

    delete user.password;
    return user;
  }

  /** Delete given user from database; returns undefined. */

  static async remove(username) {
    let result = await db.query(
          `DELETE
           FROM users
           WHERE username = $1
           RETURNING username`,
        [username],
    );
    const user = result.rows[0];

    if (!user) throw new NotFoundError(`No user: ${username}`);
  }
}


module.exports = User;
