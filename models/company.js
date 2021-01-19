"use strict";

const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for companies. */

class Company {
  /** Create a company (from data), update db, return new company data.
   *
   * data should be { handle, name, description, numEmployees, logoUrl }
   *
   * Returns { handle, name, description, numEmployees, logoUrl }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({ handle, name, description, numEmployees, logoUrl }) {
    const duplicateCheck = await db.query(
          `SELECT handle
           FROM companies
           WHERE handle = $1`,
        [handle]);

    if (duplicateCheck.rows[0])
      throw new BadRequestError(`Duplicate company: ${handle}`);

    const result = await db.query(
          `INSERT INTO companies
           (handle, name, description, num_employees, logo_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING handle, name, description, num_employees AS "numEmployees", logo_url AS "logoUrl"`,
        [
          handle,
          name,
          description,
          numEmployees,
          logoUrl,
        ],
    );
    const company = result.rows[0];

    return company;
  }

  /** Find all companies.  Handles name, minEmployees, maxEmployees filters.
   *
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   * */

  static async findAll(query = {}) {
    let companiesRes;

    if (Object.keys(query).length === 0) {
      // if there are no query strings, simply return all companies
      companiesRes = await db.query(
        `SELECT handle,
                name,
                description,
                num_employees AS "numEmployees",
                logo_url AS "logoUrl"
         FROM companies
         ORDER BY name`);
      
      return companiesRes.rows;
    } else {
      // if there is at least 1 query string, then add those filters

      // first, we filter out any filters that shouldn't exist
      for (let property in query) {
        const validFilters = ['name', 'minEmployees', 'maxEmployees'];

        // if any of the filter names in the query object are not one of the above validFilters, then throw an error
        if (!validFilters.includes(property)) {
          throw new BadRequestError(`'${property}' is not a valid filter.  Only valid filters are 'name', 'minEmployees', and 'maxEmployees'.`);
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
      let name;
      let minEmployees;
      let maxEmployees;

      if (query.name && typeof query.name === 'string') {
        name = query.name;
        // "name ILIKE '%$1%'" didn't work, so we had to put the %%'s inside the parameterized query value itself
        const nameWithPercents = `%${name}%`;
        values.push(nameWithPercents);
        // Since we're checking for name first, if it exists, it will always be the first element in the values array,
        // therefore we can hard-code it as $1
        whereClause = "name ILIKE $1";
      }

      if (query.minEmployees && !isNaN(query.minEmployees)) {
        minEmployees = parseInt(query.minEmployees);
        values.push(minEmployees);
        const minEmployeesIdx = values.indexOf(minEmployees) + 1;
        // if minEmployees is the first element in the values array, then its parameterized query is $1, if not, it'll be
        // whatever its index in values is + 1
        whereClause += (minEmployeesIdx === 1) ? "num_employees >= $1" : ` AND num_employees >= $${minEmployeesIdx}`;
      }

      if (query.maxEmployees && !isNaN(query.maxEmployees)) {
        maxEmployees = parseInt(query.maxEmployees);
        values.push(maxEmployees);
        // we get an error if minEmployees and maxEmployees are the same number, because using .indexOf(), that will only find
        // the index of the first instance of that number in the array, so minEmployees and maxEmployees parameterized queries
        // will be the same.  This line below fixes that.
        const maxEmployeesIdx = (minEmployees && minEmployees === maxEmployees) ? values.indexOf(maxEmployees) + 2 : values.indexOf(maxEmployees) + 1;
        whereClause += (maxEmployeesIdx === 1) ? "num_employees <= $1" : ` AND num_employees <= $${maxEmployeesIdx}`;
      }

      if (minEmployees && maxEmployees && minEmployees > maxEmployees) {
        throw new BadRequestError("'minEmployees' cannot be greater than 'maxEmployees'");
      }
      
      // and finally, it is possible that the filter names could exist in query, but that their values could be falsy or just
      // not exist, so we have to check for that too and just return all companies if that's the case
      if (!name && !minEmployees && !maxEmployees) {
        companiesRes = await db.query(
          `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies
           ORDER BY name`);
        
        return companiesRes.rows;
      }

      // otherwise, we plug in the final whereClause and the accompanying values array to our sql query
      companiesRes = await db.query(
        `SELECT handle,
                name,
                description,
                num_employees AS "numEmployees",
                logo_url AS "logoUrl"
         FROM companies
         WHERE ${whereClause}
         ORDER BY name`, values);

      return companiesRes.rows;
    }
  }

  /** Given a company handle, return data about company.
   *
   * Returns { handle, name, description, numEmployees, logoUrl, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(handle) {
    const jobsRes = await db.query(`
           SELECT id,
                  title,
                  salary,
                  equity
           FROM jobs
           WHERE company_handle = $1
           ORDER BY id DESC`, [handle]);
    
    const jobs = jobsRes.rows;
    
    const companyRes = await db.query(
          `SELECT handle,
                  name,
                  description,
                  num_employees AS "numEmployees",
                  logo_url AS "logoUrl"
           FROM companies
           WHERE handle = $1`,
        [handle]);

    const result = companyRes.rows[0];

    if (!result) throw new NotFoundError(`No company: ${handle}`);
    
    result.jobs = jobs;

    return result;
  }

  /** Update company data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {name, description, numEmployees, logoUrl}
   *
   * Returns {handle, name, description, numEmployees, logoUrl}
   *
   * Throws NotFoundError if not found.
   */

  static async update(handle, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          numEmployees: "num_employees",
          logoUrl: "logo_url",
        });
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE companies 
                      SET ${setCols} 
                      WHERE handle = ${handleVarIdx} 
                      RETURNING handle, 
                                name, 
                                description, 
                                num_employees AS "numEmployees", 
                                logo_url AS "logoUrl"`;
    const result = await db.query(querySql, [...values, handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(handle) {
    const result = await db.query(
          `DELETE
           FROM companies
           WHERE handle = $1
           RETURNING handle`,
        [handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);
  }
}


module.exports = Company;
