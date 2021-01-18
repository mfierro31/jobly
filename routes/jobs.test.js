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

  let returnedJob = newJob;
  returnedJob.equity = "0.03";

  test("works for admin users", async () => {
    const res = await request(app).post('/jobs').send(newJob).set('authorization', `Bearer ${u4Token}`);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      job: returnedJob
    });
  });
});