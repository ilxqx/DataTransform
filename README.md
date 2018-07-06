# DataTransform
This is a simple tool for data transfer or transform.


# Usage
You only need to modify the config.json file to run this tool.

## config.json
```js
{
  "source": {
    "host": "domain", // the source database information
    "user": "user", // database user
    "password": "password", // database password
    "port": 3306, // database port
    "database": "source" // database name
  },
  "destination": {
    "host": "destinationDomain", // the destination database information
    "user": "user", // database user
    "password": "password", // database password
    "port": 3306, // database port
    "database": "destination" // database name
  },
  "sourceTable": "sourceTable", // the name of table in source database
  "destinationTable": {
    "name": "destinationTable", // the name of table in destination database
    "assert": { // assertion is used to predicate whether every record need to be inserted to the destination table
      "field": "not null" // the key is the name of field in destination table. the value is null or not null, null value indicates this record including it will not be inserted to destination table, not null value reverse.
    },
    "fields": [ // this array setup for the certain value of field in destination table mapped from source value of field in source table.
      {
        "name": "field", //  the naem of field in destination table
        "valueType": "destinationQuery", // the type of value of field, it can be custom, reference, sourceQuery or destinationQuery
        "value": "SELECT `id` FROM `someTable` WHERE `username` = ${username}" // if valueType property is qeury type
        // (sourceQuery, execute the sql in source connection condition, or destinationQuery, execute the sql in destination connection condition)
        // , it must be a sql string.
      },
      {
        "name": "fieldTwo", // the name of field in destination table
        "valueType": "reference", // if valueType property is reference, then this field value will be same with the value of the field in source table according to the value of value property
        "value": "refField" // it used to indicate whether value of field in source table should be assigned. 
      },
      {
        "name": "fieldThree", // the naem of field in destination table
        "valueType": "custom", // if valueType property is custom, then this  field value will be same with the value of value property
        "value": "customValue" // this value will be assigned to the corresponding field in destination based on the value of name property
      }
    ]
  }
}
```
> Although this tool is quite simple, it is powful.

> Believe after looking the comment in config.json file above, you know how to use it.
