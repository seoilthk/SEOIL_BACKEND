// src/config/db.js
const mysql = require('mysql2/promise'); // 프로미스 기반으로 사용하면 코드가 훨씬 깔끔합니다.
require('dotenv').config();

// Connection Pool 생성 (보안 및 성능 최적화)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10, // 동시에 여러 사용자가 접속해도 처리가 가능하게 함
    queueLimit: 0
});

module.exports = pool;