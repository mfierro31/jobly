"use strict";

const db = require("../db.js");
const { BadRequestError, NotFoundError } = require("../expressError");
const Job = require("./job");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
} = require("./_testCommon");

let jobId;

beforeAll(commonBeforeAll);

beforeEach(async () => {
  commonBeforeEach();
  const result = await db.query(`SELECT id FROM jobs WHERE title = 'Software Engineer I'`);
  jobId = result.rows[0].id;
});
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** create */

// REMEMBER - our equity column, our NUMERIC data type, actually converts to a String in JavaScript

describe("create", () => {
  const job = {
    title: 'Test Title',
    salary: 100000,
    equity: 0.05,
    companyHandle: 'c3'
  };

  test("works", async () => {
    const newJob = await Job.create(job);
    expect(newJob).toEqual({
      id: expect.any(Number),
      title: 'Test Title',
      salary: 100000,
      equity: "0.05",
      companyHandle: 'c3'
    });

    const result = await db.query(`
                SELECT id, title, salary, equity, company_handle AS "companyHandle"
                FROM jobs
                WHERE id = ${newJob.id}
    `);

    expect(result.rows).toEqual([{
      id: newJob.id,
      title: 'Test Title',
      salary: 100000,
      equity: "0.05",
      companyHandle: 'c3'
    }]);
  });

  test("bad request if company handle doesn't exist", async () => {
    let job2 = job;
    job2.companyHandle = 'nope';

    try {
      await Job.create(job2);
    } catch(err) {
      expect(err instanceof BadRequestError).toBeTruthy();
      expect(err.message).toEqual('nope is an invalid company handle');
    }
  });
});

/************************************** findAll */

describe("findAll", () => {
  test("works: no filter", async () => {
    const expected = [
      {
        id: expect.any(Number),
        title: 'Software Engineer I',
        salary: 70000,
        equity: "0.09",
        companyHandle: 'c1'
      },
      {
        id: expect.any(Number),
        title: 'Software Engineer II',
        salary: 100000,
        equity: "0.05",
        companyHandle: 'c1'
      },
      {
        id: expect.any(Number),
        title: 'Software Engineer III',
        salary: 150000,
        equity: "0.03",
        companyHandle: 'c2'
      }
    ];

    const results = await Job.findAll();
    
    // Since findAll sorts all jobs in DESC order by their id numbers, and since we don't know the jobs' id numbers, we can't
    // just put our job objects in an array and expect them to be in the correct order every time.  To fix this, we can use
    // expect.arrayContaining which doesn't care about the order, it just looks to see if the same elements in one array are in
    // another array.
    expect(results).toEqual(expect.arrayContaining(expected));
  });

  test("works: all filters", async () => {
    const query = {
      title: 'software',
      minSalary: 150000,
      hasEquity: 'true'
    };

    const results = await Job.findAll(query);

    expect(results).toEqual([
      {
        id: expect.any(Number),
        title: 'Software Engineer III',
        salary: 150000,
        equity: '0.03',
        companyHandle: 'c2'
      }
    ]);
  });
});

/************************************** get */

describe("get", () => {
  test("works", async () => {
    const result = await Job.get(jobId);

    expect(result).toEqual({
      id: jobId,
      title: 'Software Engineer I',
      salary: 70000,
      equity: "0.09",
      companyHandle: 'c1'
    });
  });

  test("not found error if job id invalid", async () => {
    try {
      await Job.get(0);
    } catch(err) {
      expect(err instanceof NotFoundError).toBeTruthy();
      expect(err.message).toEqual('No job with id of: 0');
    }
  });
});

/************************************** update */

describe("update", () => {
  test("updates all possible fields", async () => {
    const data = {
      title: 'Entry Level Software Engineer',
      salary: 65000,
      equity: 0.08
    };

    const job = await Job.update(jobId, data);

    expect(job).toEqual({
      id: jobId,
      title: 'Entry Level Software Engineer',
      salary: 65000,
      equity: "0.08",
      companyHandle: 'c1'
    });

    const result = await db.query(`SELECT id, title, salary, equity, company_handle
                                   FROM jobs WHERE id = ${jobId}`);
    
    expect(result.rows[0]).toEqual({
      id: jobId,
      title: 'Entry Level Software Engineer',
      salary: 65000,
      equity: "0.08",
      company_handle: 'c1'
    });
  });

  test("updates only 1 field", async () => {
    const data = {
      salary: 75000
    }

    const job = await Job.update(jobId, data);

    expect(job).toEqual({
      id: jobId,
      title: 'Software Engineer I',
      salary: 75000,
      equity: "0.09",
      companyHandle: 'c1'
    });

    const result = await db.query(`SELECT id, title, salary, equity, company_handle
                                   FROM jobs WHERE id = ${jobId}`);
                      
    expect(result.rows[0]).toEqual({
      id: jobId,
      title: 'Software Engineer I',
      salary: 75000,
      equity: "0.09",
      company_handle: 'c1'
    });
  });

  test("accepts 'null' for salary and equity", async () => {
    const data = {
      salary: null,
      equity: null
    };

    const job = await Job.update(jobId, data);
    
    expect(job).toEqual({
      id: jobId,
      title: 'Software Engineer I',
      salary: null,
      equity: null,
      companyHandle: 'c1'
    });

    const result = await db.query(`SELECT id, title, salary, equity, company_handle
                                   FROM jobs WHERE id = ${jobId}`);

    expect(result.rows[0]).toEqual({
      id: jobId,
      title: 'Software Engineer I',
      salary: null,
      equity: null,
      company_handle: 'c1'
    });
  });

  test("not found error if job id doesn't exist", async () => {
    const data = {
      title: 'Entry Level Software Engineer'
    };

    try {
      await Job.update(0, data);
    } catch(err) {
      expect(err instanceof NotFoundError).toBeTruthy();
      expect(err.message).toEqual("No job with id of: 0");
    }
  });

  test("bad request error if no data passed in", async () => {
    try {
      await Job.update(jobId, {});
    } catch(err) {
      expect(err instanceof BadRequestError).toBeTruthy();
      expect(err.message).toEqual("No data");
    }
  });
});

/************************************** remove */

describe("remove", () => {
  test("works", async () => {
    await Job.remove(jobId);
    const result = await db.query(`SELECT id FROM jobs WHERE id = ${jobId}`);
    expect(result.rows.length).toBe(0);
  });

  test("not found error if job id doesn't exist", async () => {
    try {
      await Job.remove(0);
    } catch(err) {
      expect(err instanceof NotFoundError).toBeTruthy();
      expect(err.message).toEqual("No job found with id of: 0");
    }
  });
});