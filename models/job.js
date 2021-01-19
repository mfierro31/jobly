"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for jobs. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, companyHandle }, with salary and equity being optional.
   *
   * Returns { id, title, salary, equity, companyHandle }
   * 
   * If companyHandle cannot be found, throws a BadRequestError
   *
   * */

  static async create({ title, salary, equity, companyHandle }) {
    // Can't handle this in JSON Schema, so have to do it ourselves here.  Make company handle lower case.
    const lowerCaseHandle = companyHandle.toLowerCase();
    // Check to see if company handle even exists.  If not, throw an error.
    const companyCheck = await db.query(`SELECT handle FROM companies WHERE handle = $1`, [lowerCaseHandle]);

    if (companyCheck.rows.length === 0) {
      throw new BadRequestError(`${lowerCaseHandle} is an invalid company handle`);
    }

    const result = await db.query(
          `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4)
           RETURNING id, title, salary, equity, company_handle AS "companyHandle"`,
        [
          title, 
          salary, 
          equity, 
          lowerCaseHandle
        ]
    );
    const job = result.rows[0];

    return job;
  }

  /** Find all jobs.  Also handles filters: title, minSalary, and hasEquity
   *
   * Returns [{ id, title, salary, equity, companyHandle }, ...]
   * */

  static async findAll(query) {
    let jobsRes;

    if (Object.keys(query).length === 0) {
      // if there are no query strings, simply return all companies
      jobsRes = await db.query(
        `SELECT id,
                title,
                salary,
                equity,
                company_handle AS "companyHandle"
         FROM jobs
         ORDER BY id DESC`);
      
      return jobsRes.rows;
    } else {
      // if there is at least 1 query string, then add those filters

      // first, we filter out any filters that shouldn't exist
      for (let property in query) {
        const validFilters = ['title', 'minSalary', 'hasEquity'];

        // if any of the filter names in the query object are not one of the above validFilters, then throw an error
        if (!validFilters.includes(property)) {
          throw new BadRequestError(`'${property}' is not a valid filter.  Only valid filters are 'title', 'minSalary', and 'hasEquity'.`);
        }

        // Also, if the same filter name is included more than once, that causes problems too.  When that does happen, its value
        // becomes an array.  So here, we check to see if any of the properties' value is an array.  If so, throw error.
        if (Array.isArray(query[property])) {
          throw new BadRequestError(`Can't include '${property}' more than once.`);
        }
      }
      // we start with an empty whereClause and values array
      // as we check to see if each of the 3 filters exist, we add on to the whereClause and the values array
      let whereClause = "";
      let values = [];
      let title;
      let minSalary;

      if (query.title && typeof query.title === 'string') {
        title = query.title;
        // "name ILIKE '%$1%'" didn't work, so we had to put the %%'s inside the parameterized query value itself
        const titleWithPercents = `%${title}%`;
        values.push(titleWithPercents);
        // Since we're checking for name first, if it exists, it will always be the first element in the values array,
        // therefore we can hard-code it as $1
        whereClause = "title ILIKE $1";
      }

      if (query.minSalary && !isNaN(query.minSalary)) {
        minSalary = parseInt(query.minSalary);
        values.push(minSalary);
        const minSalaryIdx = values.indexOf(minSalary) + 1;
        // if minSalary is the first element in the values array, then its parameterized query is $1, if not, it'll be
        // whatever its index in values is + 1
        whereClause += (minSalaryIdx === 1) ? "salary >= $1" : ` AND salary >= $${minSalaryIdx}`;
      }

      if (query.hasEquity && typeof query.hasEquity === 'string' && query.hasEquity.toLowerCase() === "true") {
        values.push(0);
        // we get an error if minSalary is 0, because that's what we're pushing into values for hasEquity.  Using .indexOf(), that will only find
        // the index of the first instance of 0 in the array, so minSalary and hasEquity's parameterized queries
        // will be the same.  This line below fixes that.
        const hasEquityIdx = (minSalary === 0) ? values.indexOf(0) + 2 : values.indexOf(0) + 1;
        whereClause += (hasEquityIdx === 1) ? "equity > $1" : ` AND equity > $${hasEquityIdx}`;
      }
      
      // It is possible that the filter names could exist in query, but that their values could be falsy or just
      // not exist, so we have to check for that too and just return all jobs if that's the case
      if (!title && !minSalary && minSalary !== 0 && !hasEquity) {
        jobsRes = await db.query(
          `SELECT id,
                  title,
                  salary,
                  equity,
                  company_handle AS "companyHandle"
           FROM jobs
           ORDER BY id DESC`);
        
        return jobsRes.rows;
      }

      // otherwise, we plug in the final whereClause and the accompanying values array to our sql query
      jobsRes = await db.query(
        `SELECT id,
                title,
                salary,
                equity,
                company_handle AS "companyHandle"
         FROM jobs
         WHERE ${whereClause}
         ORDER BY id DESC`, values);

      return jobsRes.rows;
    }
  }

  /** Given a job id, return data about job.
   *
   * Returns { id, title, salary, equity, companyHandle }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const jobRes = await db.query(
          `SELECT id,
                  title,
                  salary,
                  equity,
                  company_handle AS "companyHandle"
           FROM jobs
           WHERE id = $1`,
        [id]);

    const job = jobRes.rows[0];

    if (!job) throw new NotFoundError(`No job with id of: ${id}`);

    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: { title, salary, equity }
   *
   * Returns { id, title, salary, equity, companyHandle }
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    // This time, we don't have to worry about any column names that are two or more words long to convert to sql, so we just
    // pass in an empty object to sqlForPartialUpdate
    const { setCols, values } = sqlForPartialUpdate(data, {});

    const idIndex = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idIndex} 
                      RETURNING id,
                                title,
                                salary,
                                equity,
                                company_handle AS "companyHandle"`;
    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job with id of: ${id}`);

    return job;
  }

  /** Delete given job from database;
   *
   * Throws NotFoundError if job not found.
   **/

  static async remove(id) {
    const result = await db.query(
          `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
        [id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job found with id of: ${id}`);
  }
}


module.exports = Job;
