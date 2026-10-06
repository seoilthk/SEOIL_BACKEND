require('dotenv').config();
const pool = require('./src/config/db');

async function test() {
    try {
        const [rows] = await pool.query('SELECT * FROM Courses');
        console.log("Success:", rows);
    } catch (e) {
        console.error("Error:", e);
    } finally {
        process.exit();
    }
}

test();
