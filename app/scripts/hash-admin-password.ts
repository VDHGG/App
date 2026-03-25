import bcrypt from 'bcryptjs';

const plain = process.argv[2];
if (!plain) {
  console.error('Usage: npx vite-node scripts/hash-admin-password.ts <plain-password>');
  process.exit(1);
}

const hash = bcrypt.hashSync(plain, 10);
console.log(hash);
 