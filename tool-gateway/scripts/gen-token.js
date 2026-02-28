import 'dotenv/config';
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET || 'change-me-to-a-strong-secret';
const approvalSecret = process.env.APPROVAL_TOKEN_SECRET || 'change-me-to-another-strong-secret';

const userId = 'user_123';

// 1. Tạo Auth Token (Bearer)
const authToken = jwt.sign({ sub: userId }, secret, { expiresIn: '365d' });

// 2. Tạo Approval Token (Cho Tier 2) - Ví dụ cho tool delete_account
const approvalToken = jwt.sign({
    sub: userId,
    act: 'delete_account',
    rid: 'all', // Resource ID
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // Hết hạn sau 1 tiếng
}, approvalSecret);

console.log('--- AUTH TOKEN (Bearer) ---');
console.log(authToken);
console.log('\n--- APPROVAL TOKEN (X-MM-Approval-Token) ---');
console.log(approvalToken);
console.log('\nVí dụ lệnh cURL:');
console.log(`curl -H "Authorization: Bearer ${authToken}" http://localhost:3200/api/v1/get_accounts`);
