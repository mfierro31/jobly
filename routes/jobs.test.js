"use strict";

const request = require("supertest");

const db = require("../db");
const app = require("../app");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token,
  u4Token
} = require("./_testCommon");

const { authenticate } = require("../models/user");

let jobId;

beforeAll(commonBeforeAll);
beforeEach(async () => {
  commonBeforeEach();
  const result = await db.query(`SELECT id FROM jobs WHERE title = 'Job1'`);
  jobId = result.rows[0].id;
});
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** POST /jobs */

describe("POST /jobs", () => {
  const newJob = {
    title: 'Job4',
    salary: 200000,
    equity: 0.03,
    companyHandle: 'c3'
  };

  // With the spread operator for objects, if there's a property or properties that you want to overwrite, you can do so by 
  // setting their name to a different value AFTER spreading
  const returnedJob = {...newJob, equity: '0.03'};

  test("works for admin users", async () => {
    const res = await request(app)
                .post('/jobs')
                .send(newJob)
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      job: {
        id: expect.any(Number),
        ...returnedJob
      }
    });
  });

  test("works leaving out 'salary' and 'equity'", async () => {
    const res = await request(app)
                .post('/jobs')
                .send({ title: 'Job4', companyHandle: 'c3' })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      job: {
        id: expect.any(Number),
        ...newJob,
        salary: null,
        equity: null
      }
    });
  });

  test("bad request error for missing required data", async () => {
    const res = await request(app)
                .post('/jobs')
                .send({ salary: 200000, equity: 0.03 })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(400);
  });

  test("bad request error for no data", async () => {
    const res = await request(app)
                .post('/jobs')
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(400);
  });

  test("bad request error for invalid data", async () => {
    const res = await request(app)
                .post('/jobs')
                .send({ title: true, companyHandle: 3 })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(400);
  });

  test("unauth error for users not logged in", async () => {
    const res = await request(app)
                .post('/jobs')
                .send(newJob)

    expect(res.statusCode).toBe(401);
  });

  test("unauth error for non-admin users", async () => {
    const res = await request(app)
                .post('/jobs')
                .send(newJob)
                .set('authorization', `Bearer ${u1Token}`);

    expect(res.statusCode).toBe(401);
  });
});

/************************************** GET /jobs */

describe("GET /jobs", () => {
  test("works: no filters", async () => {
    const expected = [
      {
        id: expect.any(Number),
        title: 'Job1',
        salary: 65000,
        equity: "0.09",
        companyHandle: 'c1'
      },
      {
        id: expect.any(Number),
        title: 'Job2',
        salary: 95000,
        equity: "0.07",
        companyHandle: 'c1'
      },
      {
        id: expect.any(Number),
        title: 'Job3',
        salary: 125000,
        equity: "0.05",
        companyHandle: 'c2'
      }
    ];

    const res = await request(app).get('/jobs');

    expect(res.statusCode).toBe(200);

    // Since our Job.findAll() method sorts our results in DESC order by id number, and since we don't know any of the
    // jobs' id numbers, we can't assume they're going to be in a certain order every time.  expect.arrayContaining() to the
    // rescue!  We just pass our job objects into that method and it will look for those objects in our response, no
    // matter what order they're in
    expect(res.body).toEqual({
      jobs: expect.arrayContaining(expected)
    });
  });

  test("works: all filters", async () => {
    const query = {
      title: 'job',
      minSalary: 125000,
      hasEquity: 'true'
    }

    const res = await request(app).get('/jobs').query(query);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: 'Job3',
          salary: 125000,
          equity: '0.05',
          companyHandle: 'c2'
        }
      ]
    });
  });

  test("works: 2 filters", async () => {
    const query = {
      minSalary: 125000,
      hasEquity: 'true'
    }

    const res = await request(app).get('/jobs').query(query);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: 'Job3',
          salary: 125000,
          equity: '0.05',
          companyHandle: 'c2'
        }
      ]
    });
  });

  test("works: 1 filter", async () => {
    const query = {
      minSalary: 125000
    }

    const res = await request(app).get('/jobs').query(query);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      jobs: [
        {
          id: expect.any(Number),
          title: 'Job3',
          salary: 125000,
          equity: '0.05',
          companyHandle: 'c2'
        }
      ]
    });
  });

  test("fails: test next() handler", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-handler works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE jobs CASCADE");
    const resp = await request(app).get("/jobs");
    expect(resp.statusCode).toEqual(500);
  });

  test("Receive a 400 error if we send a filter that doesn't exist", async () => {
    const resp = await request(app).get('/jobs').query({ color: 'purple' });
    expect(resp.statusCode).toBe(400);
    expect(resp.body.error.message).toEqual("'color' is not a valid filter.  Only valid filters are 'title', 'minSalary', and 'hasEquity'.");
  });

  test("Receive a 400 error if we send the same filter twice", async () => {
    // default object behavior in JavaScript will overwrite a property if it's previously already been defined, so if we send
    // our query as an object in this case, like { title: 'I', title: 'II' }, the object will just be converted to { title: 'II' }
    // so we have to put title twice directly in the URL for this test to work
    const resp = await request(app).get('/jobs?title=I&title=II');
    expect(resp.statusCode).toBe(400);
    expect(resp.body.error.message).toEqual("Can't include 'title' more than once.");
  });
});

/************************************** GET /jobs/:id */

describe("GET /jobs/:id", () => {
  test("works", async () => {
    const res = await request(app).get(`/jobs/${jobId}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      job: {
        id: jobId,
        title: 'Job1',
        salary: 65000,
        equity: '0.09',
        companyHandle: 'c1' 
      }
    });
  });

  test("not found error for job id that doesn't exist", async () => {
    const res = await request(app).get('/jobs/0');

    expect(res.statusCode).toBe(404);
  });
});

/************************************** PATCH /jobs/:id */

describe("PATCH /jobs/:id", () => {
  test("works for admin users", async () => {
    const res = await request(app)
                .patch(`/jobs/${jobId}`)
                .send({ title: 'JobbyJobJob' })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      job: {
        id: jobId,
        title: 'JobbyJobJob',
        salary: 65000,
        equity: '0.09',
        companyHandle: 'c1'
      }
    });
  });

  test("unauth error for non-admin users", async () => {
    const res = await request(app)
                .patch(`/jobs/${jobId}`)
                .send({ title: 'JobbyJobJob' })
                .set('authorization', `Bearer ${u1Token}`);

    expect(res.statusCode).toBe(401);
  });

  test("unauth error for users not logged in", async () => {
    const res = await request(app)
                .patch(`/jobs/${jobId}`)
                .send({ title: 'JobbyJobJob' });

    expect(res.statusCode).toBe(401);
  });

  test("not found error for job id that doesn't exist", async () => {
    const res = await request(app)
                .patch(`/jobs/0`)
                .send({ title: 'JobbyJobJob' })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.message).toEqual("No job with id of: 0");
  });

  test("bad request error on id change attempt", async () => {
    const res = await request(app)
                .patch(`/jobs/${jobId}`)
                .send({ id: 300 })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(400);
  });

  test("bad request error on companyHandle change attempt", async () => {
    const res = await request(app)
                .patch(`/jobs/${jobId}`)
                .send({ companyHandle: 'c3' })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(400);
  });

  test("bad request error with invalid data", async () => {
    const res = await request(app)
                .patch(`/jobs/${jobId}`)
                .send({ title: 300 })
                .set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(400);
  });
});

/************************************** DELETE /jobs/:id */

describe("DELETE /jobs/:id", () => {
  test("works for admins", async () => {
    const res = await request(app).delete(`/jobs/${jobId}`).set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(200);
    // In our DELETE route, we take the job id from the URL parameter, which will always be a string, so we have to check for 
    // an id in String form this time
    expect(res.body).toEqual({ deleted: jobId.toString() });
  });

  test("unauth error for non-admins", async () => {
    const res = await request(app).delete(`/jobs/${jobId}`).set('authorization', `Bearer ${u1Token}`);

    expect(res.statusCode).toBe(401);
  });

  test("unauth error for users not logged in", async () => {
    const res = await request(app).delete(`/jobs/${jobId}`);

    expect(res.statusCode).toBe(401);
  });

  test("not found error for job id that doesn't exist", async () => {
    const res = await request(app).delete(`/jobs/0`).set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.message).toEqual("No job found with id of: 0");
  });
});