CREATE TABLE companies (
  handle VARCHAR(25) PRIMARY KEY CHECK (handle = lower(handle)),
  name TEXT UNIQUE NOT NULL,
  num_employees INTEGER CHECK (num_employees >= 0),
  description TEXT NOT NULL,
  logo_url TEXT
);

CREATE TABLE users (
  username VARCHAR(25) PRIMARY KEY,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL
    CHECK (position('@' IN email) > 1),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE
);

-- In the below table, we use a data type called NUMERIC.  It's basically like the FLOAT data type, but can store A TON more
-- numbers.  Also, the precision can be set or you can just leave it like it is below and let it be any length as long as it
-- is within the maximum length.  This link provides more details - https://www.postgresqltutorial.com/postgresql-numeric/
-- NOTE: When we get a NUMERIC data type back in JavaScript, it's a string data type.

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  salary INTEGER CHECK (salary >= 0),
  equity NUMERIC CHECK (equity <= 1.0),
  company_handle VARCHAR(25) NOT NULL
    REFERENCES companies ON DELETE CASCADE
);

CREATE TABLE applications (
  username VARCHAR(25)
    REFERENCES users ON DELETE CASCADE,
  job_id INTEGER
    REFERENCES jobs ON DELETE CASCADE,
  PRIMARY KEY (username, job_id)
);
