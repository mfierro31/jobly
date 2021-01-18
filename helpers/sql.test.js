const { BadRequestError } = require("../expressError");
const { sqlForPartialUpdate } = require("./sql");

let jsToSql;

beforeEach(() => {
  jsToSql = {
    numEmployees: "num_employees",
    logoUrl: "logo_url"
  };
});

describe("Test sqlForPartialUpdate function", () => {
  test("Sends back object given all required and correct data", () => {
    const dataToUpdate = {
      name: "Toyota",
      description: "Automobile maker",
      numEmployees: 5000,
      logoUrl: "https://global.toyota/pages/global_toyota/mobility/toyota-brand/emblem_ogp_001.png"
    };

    const res = sqlForPartialUpdate(dataToUpdate, jsToSql);

    expect(res).toEqual({
      setCols: `"name"=$1, "description"=$2, "num_employees"=$3, "logo_url"=$4`,
      values: ["Toyota", "Automobile maker", 5000, "https://global.toyota/pages/global_toyota/mobility/toyota-brand/emblem_ogp_001.png"]
    });
  });

  test("Sends back object only given partial data in dataToUpdate", () => {
    const dataToUpdate = {
      description: "Car maker",
      numEmployees: 4000
    };

    const res = sqlForPartialUpdate(dataToUpdate, jsToSql);

    expect(res).toEqual({
      setCols: `"description"=$1, "num_employees"=$2`,
      values: ["Car maker", 4000]
    });
  });

  test("Throws a 400 BadRequestError if no data is sent", () => {
    const dataToUpdate = {};

    try {
      const res = sqlForPartialUpdate(dataToUpdate, jsToSql);
    } catch(err) {
      expect(err instanceof BadRequestError).toBeTruthy();
    }
  });
});