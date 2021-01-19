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

