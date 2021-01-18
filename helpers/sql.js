const { BadRequestError } = require("../expressError");

// Takes data from a request (dataToUpdate) and a jsToSql object that contains column names that are two or more words 
// long, where the values are the SQL format of those words (separated by _) and returns parts of a SQL query - setCols,  
// which is a string of all column names being updated followed by the parameterized query (=$1) - and values, which is  
// the values for those column names taken from the dataToUpdate object
function sqlForPartialUpdate(dataToUpdate, jsToSql) {
  const keys = Object.keys(dataToUpdate);
  if (keys.length === 0) throw new BadRequestError("No data");

  // {firstName: 'Aliya', age: 32} => ['"first_name"=$1', '"age"=$2']
  // only the column names that are 2 or more words long will be jsToSql[colName]
  const cols = keys.map((colName, idx) =>
      `"${jsToSql[colName] || colName}"=$${idx + 1}`,
  );

  return {
    setCols: cols.join(", "),
    values: Object.values(dataToUpdate),
  };
}

module.exports = { sqlForPartialUpdate };
