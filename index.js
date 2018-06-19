const fs = require('fs');
const mysql = require('mysql');
const async = require('async');

// 定义配置json文件位置
const configJsonFilePath = __dirname + '/config.json';
// 解析配置文件
const config = JSON.parse(fs.readFileSync(configJsonFilePath).toString('UTF-8'));
// 创建数据库连接
const source = config.source;
const destination = config.destination;
const sourceConnection = mysql.createConnection(source);
const destinationConnection = mysql.createConnection(destination);
// 建立连接
sourceConnection.connect();
destinationConnection.connect();
// 开启事务
destinationConnection.beginTransaction();
// 创建策略
const strategies = {
    // 自定义值
    custom: (fieldInfo, curRowData, cb) => {
        cb(null, fieldInfo.value);
    },
    // 引用值
    reference: (fieldInfo, curRowData, cb) => {
        cb(null, curRowData[fieldInfo.value]);
    },
    // 源数据库查询
    sourceQuery: (fieldInfo, curRowData, cb) => {
        // 编译sql语句
        let regExp = /\$\{([A-Za-z0-9_-]+)\}/g;
        let res;
        let sql = fieldInfo.value;
        let params = [];
        while ((res = regExp.exec(fieldInfo.value)) != null) {
            if (res[1] in curRowData) {
                sql = sql.replace(res[0], '?');
                params.push(curRowData[res[1]]);
            }
        }
        // 执行sql语句
        sourceConnection.query(sql, params, (err, result) => {
            if (err) {
                console.log('执行SQL：' + sql + '失败');
                destinationConnection.rollback();
                throw err;
            }
            if (result.length === 0) {
                return cb(null, null);
            }
            for (let key in result[0]) {
                if (result[0].hasOwnProperty(key)) {
                    return cb(null, result[0][key]);
                }
            }
            return cb(null, null);
        });
    },
    // 目标数据库查询
    destinationQuery: (fieldInfo, curRowData, cb) => {
        // 编译sql语句
        let regExp = /\$\{([A-Za-z0-9_-]+)\}/g;
        let res;
        let sql = fieldInfo.value;
        let params = [];
        while ((res = regExp.exec(fieldInfo.value)) != null) {
            if (res[1] in curRowData) {
                sql = sql.replace(res[0], '?');
                params.push(curRowData[res[1]]);
            }
        }
        // 执行sql语句
        destinationConnection.query(sql, params, (err, result) => {
            if (err) {
                console.log('执行SQL：' + sql + '失败');
                destinationConnection.rollback();
                throw err;
            }
            if (result.length === 0) {
                return cb(null, null);
            }
            for (let key in result[0]) {
                if (result[0].hasOwnProperty(key)) {
                    return cb(null, result[0][key]);
                }
            }
            return cb(null, null);
        });
    }
};
// 分批转移数据
// 定义每批的大小
const batchNum = 20;
let batch = 0;
//查询记录总数
sourceConnection.query('SELECT COUNT(*) AS `count` FROM `' + config.sourceTable + '`', (err, res) => {
    if (err) {
        console('查询待转移数据总数出错');
        destinationConnection.rollback();
        throw err;
    }
    // 处理查询SQL
    const destinationTable = config.destinationTable;
    let str = '', params = '';
    destinationTable.fields.forEach((field, index) => {
        if (index === 0) {
            str += '(`';
            params += '('
        }

        if (index === destinationTable.fields.length - 1) {
            str += field.name + '`)';
            params += '?)';
        } else {
            str += field.name + '`, `';
            params += '?, ';
        }
    });
    let sql = 'INSERT INTO `' + destinationTable.name + '` ' + str + ' VALUES ' + params;
    console.log('数据转移执行SQL：' + sql);
    let count = res[0].count, curCount = 0;
    // 开始分批查询
    function batchHandle () {
        sourceConnection.query(`SELECT * FROM \`${config.sourceTable}\` LIMIT ${batch++ * batchNum}, ${batchNum}`, (err, res) => {
            console.log(`第 ${batch} 批查询，数量 ${res.length}`);
            // 处理该批数据
            transferData(res, res.length === batchNum);
        });
    }
    function transferData (data, next) {
        let c = data.length, cc = 0;
        data.forEach(rowData => {
            // 判断断言是否满足
            if (destinationTable.assert) {
                for (let key in destinationTable.assert) {
                    if (destinationTable.assert.hasOwnProperty(key)) {
                        if (key in rowData) {
                            if (destinationTable.assert[key] === 'not null' && rowData[key] == null) {
                                --c;
                                return --count;
                            }
                            if (destinationTable.assert[key] === 'null' && rowData[key] != null) {
                                --c;
                                return --count;
                            }
                        }
                    }
                }
            }
            // 制作参数
            let paramCallbacks = [];
            destinationTable.fields.forEach(field => {
                paramCallbacks.push(cb => {
                    strategies[field.valueType](field, rowData, cb);
                });
            });
            async.series(paramCallbacks, (err, results) => {
                destinationConnection.query(sql, results, (err, result) => {
                    if (err) {
                        console.log('执行SQL：' + sql + '失败');
                        destinationConnection.rollback();
                        throw err;
                    }
                    ++curCount;
                    ++cc;
                    console.log(`总共 ${count} 条数据，已经转移成功 ${curCount} 条数据`);
                    if (c === cc && next) {
                        // 继续分批查询
                        batchHandle();
                    }
                    if (count === curCount) {
                        // 数据转移结束，提交事务
                        destinationConnection.commit();
                        console.log('数据转移完毕');
                        process.exit(0);
                    }
                });
            });
        });
    }
    // 执行分批查询
    batchHandle();
});