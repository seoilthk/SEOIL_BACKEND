// src/models/userModel.js
const pool = require('../config/db');

const User = {
    // 사용자 생성 (회원가입)
    create: async (userData) => {
        const { student_id, password_hash, name, entry_year, dept_id } = userData;
        const sql = 'INSERT INTO Users (student_id, password_hash, name, entry_year, dept_id) VALUES (?, ?, ?, ?, ?)';
        const [result] = await pool.query(sql, [student_id, password_hash, name, entry_year, dept_id]);
        return result;
    },

    // 학번으로 사용자 조회 (로그인 시 사용)
    findByStudentId: async (student_id) => {
        const sql = 'SELECT * FROM Users WHERE student_id = ?';
        const [rows] = await pool.query(sql, [student_id]);
        return rows[0]; // 첫 번째 결과만 반환
    }
};

module.exports = User;